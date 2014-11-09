var express = require('express'),
    lame = require('lame'),
    fs = require('fs'),
    jade = require('jade'),
    file = require('file'),
    path = require('path'),
    mm = require('musicmetadata'),
    crypto = require('crypto'),
    Sequelize = require('sequelize'),
    request = require('request'),
    qs = require('querystring'),
    execFile = require('child_process').execFile;
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
var app = express(),
    db = new Sequelize('ricochet', 'stream', 'lolwat', {
        logging: false
    }),
    config = require('./config.js').config,
    Schema = require('./includes/schema.js'),
    LastFM = require('./includes/lastfm.js'),
    Elasticsearch = require('./includes/elasticsearch.js');

var models = Schema(db, config, updateIndex),
    lastfm = LastFM(app, db, config),
    elasticsearch = Elasticsearch('http://micro.hm:9200', 'ricochet', 'track');

// -- Passport Configuration
passport.use(new LocalStrategy(function(username, password, done) {
    models.User.find({ where: { username: username }}).success(function(user) {
        if (!user) {
            return done(null, false, { message: 'Incorrect username' });
        }

        if (!user.isValidPassword(password)) {
            return done(null, false, { message: 'Username and password do not match' });
        }

        return done(null, user);
    });
}));
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});
function isLoggedIn(req, res, next) {
    // Middleware to authenticate requests
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// -- Setup Express
app.use(express.static(__dirname + '/static/'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.set('views', __dirname + '/templates/');
app.set('view engine', 'jade');

// -- Express endpoints
app.get('/', isLoggedIn, function(req, res) {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
    });

    models.Track.findAll({
        order: 'album ASC, track_num ASC, title ASC'
    })
    .success(function(tracks) {
        tracks = models.Track.hydrateMultiple(tracks);

        res.render('index', {
            pageTitle: 'Ricochet',
            library: tracks,
            user: req.user
        });
    });
});
app.get('/play/:id', isLoggedIn, function(req, res) {
    req.connection.setTimeout(750000); // 15 minutes

    // Look up the track to get its filename
    var id = req.params['id'];
    models.Track.find({
        where: { id: id }
    })
    .success(function(track) {
        try {
            fs.readFile(track.filename, function(err, data) {
                if (err) throw err;
                res.type('audio/mpeg');
                res.send(data);
            });

        } catch (e) {
            console.log('Could not find file ' + track.filename);
            return;
        }

        // Mark as now playing in LastFM
        lastfm.nowPlaying(track, req.user);
    })
    .error(function(err) {
        console.log('Could not find file in index with id ' + id);
    });
});
app.get('/play/:id/:action', isLoggedIn, function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    models.Track.find({
        where: { id: id }
    })
    .success(function(track) {
        if (action == 'data') {
            res.json(track.hydrate());
        }
    });
});
app.post('/play/:id/:action', isLoggedIn, function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    models.Track.find({
        where: { id: id }
    })
    .success(function(track) {
        if (action == 'increment') {
            track.play_count++;
            track.save()
            .success(function(track) {
                res.render('row', {
                    track: track.hydrate()
                });
            });
        } else if (action == 'edit') {
            track.title = req.body['title'];
            track.artist = req.body['artist'];
            track.album = req.body['album'];
            track.genre = req.body['genre'];
            track.year = req.body['year'];
            track.track_num = req.body['track_num'];
            track.track_total = req.body['track_total'];
            track.disc_num = req.body['disc_num'];
            track.disc_total = req.body['disc_total'];
            console.log("Updating track with new title " + track.title);
            track.save()
            .success(function(t) {
                res.render('row', {
                    track: t.hydrate(),
                });
            });
        } else if (action == 'scrobble') {
            lastfm.scrobble(track, req.user, req.body['elapsed']);
        }
    })
    .error(function(err) {
        console.log('Could not find file in index with id ' + id);
    });
});
app.get('/search/:query?', isLoggedIn, function(req, res) {
    // Perform a plaintext search
    var query = req.params['query'];

    // If the query is empty, return all tracks
    if (!query) {
        models.Track.findAll({
            order: 'album ASC, track_num ASC, title ASC'
        })
        .success(function(tracks) {
            res.render('library', {
                library: models.Track.hydrateMultiple(tracks)
            });
        });
        return;
    }

    // Otherwise perform plaintext search
    search(query, function(results) {
        res.render('library', {
            library: models.Track.hydrateMultiple(results)
        });
    });
});
app.post('/server/reindex', isLoggedIn, function(req, res) {
    // Reindex the server
    updateIndex();
    res.send("OK");
});

// -- Profile
app.get('/profile', isLoggedIn, function(req, res) {
    models.User.find(req.user.id).success(function(user) {
        res.json(user);
        return;
    });
});
app.post('/profile/:action', isLoggedIn, function(req, res) {
    var action = req.params['action'];

    models.User.find(req.user.id).success(function(user) {
        if (action == 'edit_profile') {
            user.email_address = req.body['email_address'];
            user.save();
            res.json(user);
            return;
        } else if (action == 'edit_password') {
            var new_pwd = req.body['password'],
                new_pwd_confirm = req.body['password_confirm'];

            // Make sure passwords are not empty
            if (new_pwd == '' || new_pwd_confirm == '') {
                res.status(400).send("Password cannot be empty")
                return;
            }

            // Make sure passwords match
            if (new_pwd != new_pwd_confirm) {
                res.status(400).send("Password mismatch");
                return;
            }

            user.password = models.User.createPassword(new_pwd);
            user.save();
            res.json(user);
            return;
        } else if (action = 'edit_lastfm') {
            var scrobble = req.body['scrobble-status'] ? true : false;
            user.lastfm_scrobble = scrobble;
            user.save();
            res.json(user);
            return;
        }

        res.status(501).send("Not Implemented");
    });
});

// -- Login & Authentication
app.get('/login', function(req, res) {
    res.render('login', {
        pageTitle: 'Login'
    });
});
app.post('/login',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login'
}));
app.all('/logout', function(req, res) {
    req.logout();
    res.redirect('/login');
});

// -- LastFM
app.get('/lastfm', function(req, res) {
    var redirect_url = getRootURL() + "/lastfm/authorize",
        url = "http://www.last.fm/api/auth/?api_key=" + config.lastfm_key + "&cb=" + redirect_url;
    res.redirect(url);
});
app.get('/lastfm/authorize', isLoggedIn, function(req, res) {
    var token = req.query.token;

    if (!token) {
        res.redirect('/');
        return;
    }

    models.User.find(req.user.id).success(function(user) {
        lastfm.getSession(user, token, function() {
            res.redirect('/');
        });
    });
});
app.get('/lastfm/deauth', isLoggedIn, function(req, res) {
    models.User.find(req.user.id).success(function(user) {
        lastfm.destroySession(user, function() {
            res.redirect('/');
        });
    });
});

// Start the server
app.listen(config.port);

// -- Indexes the music library
function updateIndex() {
    // Use `find` to get a list of all files recursively in library_path
    execFile('find', [ config.library_path, '-type', 'f' ], function(err, stdout, stderr) {
        var file_list = stdout.split('\n');
        file_list.pop(); // removes current dir from file_list
        file_list.forEach(function(filename, i) {
            console.log("Indexing " + filename);

            // bail if we've found an invalid extension
            var extension = path.extname(filename).toLowerCase();
            if (config.valid_extensions.indexOf(extension) < 0) {
                console.log("Invalid extension \"" + extension + "\" found");
                return;
            }

            var id = crypto.createHash('md5').update(filename).digest('hex');
            var parser = mm(fs.createReadStream(filename), { duration: true });

            // Get id3 tags
            //id3({ file: filename, type: id3.OPEN_LOCAL }, function (err, tags) {
            parser.on('metadata', function(tags) {
                // Start building a model of metadata
                var track_data = {
                    filename: filename,
                    title: getTitle(tags.title, filename),
                    duration: tags.duration,
                    artist: tagOrDefault(tags.artist, ''),
                    album: tagOrDefault(tags.album, ''),
                    genre: tagOrDefault(tags.genre, ''),
                    year: tagOrDefault(tags.year, ''),
                    track_num: tags.track.no,
                    track_total: tags.track.of,
                    disc_num: tags.disk.no,
                    disc_total: tags.disk.of
                };

                // Check if the index already exists, otherwise create it
                models.Track.findOrCreate({ id: id }, track_data)
                .success(function(track, created) {
                    if (created) {
                        console.log("Created " + track.title);
                    } else {
                        console.log("Indexed " + track.title);
                    }

                    // Register this track for search indexing
                    elasticsearch.index(track);
                })
                .error(function(err) {
                    console.log(err);
                });
            });

            parser.on('done', function(err) {
                if (err) {
                    console.log(err);
                    stream.destroy();
                }
            });
        });
    });
}

// -- Indexer helper functions
function getTitle(title, filename) {
    if (!(title == null || title == '')) {
        return title;
    }

    var filetitle = path.basename(data.filename).match(/^\d+ (.*)\..*/);
    if (filetitle != null && filetitle.length > 1) {
        return filetitle[1];
    }
}
function tagOrDefault(tag, def) {
    if (tag == '') {
        return def;
    }
    return tag;
}

// -- Search functions
function search(query, then) {
    var qs = "'%" + query + "%'";
    models.Track.findAll({
        where: ["title LIKE " + qs + " OR artist LIKE " + qs + " OR album LIKE " + qs],
        order: 'album ASC, track_num ASC, title ASC'
    })
    .success(function(tracks) {
        then(tracks);
    });
}

// -- General helper functions
function getRootURL() {
    return config.root_url + (config.port == 80 ? '' : ':' + config.port)
}

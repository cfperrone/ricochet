var express = require('express'),
    lame = require('lame'),
    fs = require('fs'),
    jade = require('jade'),
    file = require('file'),
    path = require('path'),
    mm = require('musicmetadata'),
    crypto = require('crypto'),
    moment = require('moment'),
    Sequelize = require('sequelize'),
    request = require('request'),
    qs = require('querystring'),
    execFile = require('child_process').execFile;
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
var app = express(),
    db = new Sequelize('ricochet', 'stream', 'lolwat'),
    valid_extensions = [ '.mp3', '.wav', '.m4a', '.ogg' ],
    password_salt = '',
    lastfm_key = '',
    lastfm_secret = '';

// -- Database Configuration
var Track = db.define('track', {
    id: Sequelize.STRING(255),
    filename: Sequelize.STRING(1024),
    title: Sequelize.STRING(255),
    duration: {
        type: Sequelize.INTEGER,
        default_value: 0,
    },
    artist: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    album: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    genre: {
        type: Sequelize.STRING(255),
        default_value: '',
    },
    year: {
        type: Sequelize.STRING(16),
        default_value: '',
    },
    track_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    track_total: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    disc_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    disc_total: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    },
    play_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
    }
}, {
    timestamps: true,
    createdAt: 'create_date',
    updatedAt: 'update_date',
    underscored: true,
    freezeTableName: true,
    instanceMethods: {
        getDuration: function() {
            var m = moment.unix(parseInt(this.duration));
            if (this.duration > 3599) {
                return m.format('H:mm:ss');
            } else {
                return m.format('m:ss');
            }
        },
        // Enhances the db instance in preparation of presentation
        hydrate: function() {
            // Add a pretty duration string
            this.durationString = this.getDuration();

            return this;
        }
    },
    classMethods: {
        hydrateMultiple: function(tracks) {
            for (var i = 0; i < tracks.length; i++) {
                tracks[i] = tracks[i].hydrate();
            }
            return tracks;
        }
    }
});
var User = db.define('user', {
    id: Sequelize.INTEGER,
    username: Sequelize.STRING(255),
    email_address: Sequelize.STRING(255),
    password: Sequelize.STRING(40),
    lastfm_user: Sequelize.STRING(255),
    lastfm_session: Sequelize.STRING(64),
    lastfm_scrobble: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true,
    createdAt: 'create_date',
    updatedAt: 'update_date',
    underscored: true,
    freezeTableName: true,
    instanceMethods: {
        isValidPassword: function(input) {
            var hashed = crypto.createHash('sha1').update(password_salt + input).digest('hex');
            return (hashed === this.password);
        },
        canScrobble: function() {
            return (this.lastfm_session != '') && (this.lastfm_scrobble == true);
        }
    },
    classMethods: {
        createPassword: function(input) {
            return crypto.createHash('sha1').update(password_salt + input).digest('hex');
        }
    }
});

// -- Passport Configuration
passport.use(new LocalStrategy(function(username, password, done) {
    User.find({ where: { username: username }}).success(function(user) {
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

// -- Stream Configuration
var library_path = '/home/cperrone/music/';

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

    Track.findAll({
        order: 'album ASC, track_num ASC, title ASC'
    })
    .success(function(tracks) {
        tracks = Track.hydrateMultiple(tracks);

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
    Track.find({
        where: { id: id }
    })
    .success(function(track) {
        try {
            fs.readFile(track.filename, function(err, data) {
                if (err) throw err;
                res.type('audio/mpeg');
                res.send(data);
            });

            // Mark as now playing in LastFM
            lastFMMarkNowPlaying(track, req.user);
        } catch (e) {
            console.log('Could not find file ' + track.filename);
        }
    })
    .error(function(err) {
        console.log('Could not find file in index with id ' + id);
    });
});
app.get('/play/:id/:action', isLoggedIn, function(req, res) {
    var id = req.params['id'],
        action = req.params['action'];
    Track.find({
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
    Track.find({
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
            var elapsed = req.body['elapsed'],
                timestamp = moment().subtract(elapsed, 'seconds').format('X');

            if (req.user.lastfm_scrobble == false) {
                res.send("Scrobbling disabled");
                return;
            }

            if (req.user.lastfm_session == '') {
                res.send("No session data");
                return;
            }

            // Get a LastFM session
            var params = {
                api_key: lastfm_key,
                sk: req.user.lastfm_session,
                timestamp: timestamp,
                method: 'track.scrobble',
                artist: track.artist,
                track: track.title,
                album: track.album,
                trackNumber: track.track_num,
            };
            request.post({
                url: 'http://ws.audioscrobbler.com/2.0/?format=json',
                form: qs.stringify(getLastFMParams(params)),
            }, function(err, response, body) {
                res.send(body);
                var obj = JSON.parse(body),
                    error = obj.error;

                if (!error) {
                    console.log("LastFM: Scrobbled track " + track.id + " - " + track.title);
                    res.send("Scrobble success");
                } else {
                    console.log("LastFM Error: " + obj.message);
                    res.send("Error");
                }
            });
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
        Track.findAll({
            order: 'album ASC, track_num ASC, title ASC'
        })
        .success(function(tracks) {
            res.render('library', {
                library: Track.hydrateMultiple(tracks)
            });
        });
        return;
    }

    // Otherwise perform plaintext search
    search(query, function(results) {
        res.render('library', {
            library: Track.hydrateMultiple(results)
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
    User.find(req.user.id).success(function(user) {
        res.json(user);
        return;
    });
});
app.post('/profile/:action', isLoggedIn, function(req, res) {
    var action = req.params['action'];

    User.find(req.user.id).success(function(user) {
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

            user.password = User.createPassword(new_pwd);
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
    var url = "http://www.last.fm/api/auth/?api_key=" + lastfm_key + "&cb=";
    res.redirect(url);
});
app.get('/lastfm/authorize', isLoggedIn, function(req, res) {
    var token = req.query.token;
    console.log(token);

    if (!token) {
        res.redirect('/');
        return;
    }

    // Get a LastFM session
    var params = {
        api_key: lastfm_key,
        token: token,
        method: 'auth.getSession',
    };
    request.get({
        url: 'http://ws.audioscrobbler.com/2.0/?format=json&' + qs.stringify(getLastFMParams(params)),
    }, function(err, response, body) {
        var obj = JSON.parse(body),
            error = obj.error;

        if (error) {
            console.log("LastFM Error: " + obj.message);
            res.redirect('/');
            return;
        }

        // Save the LastFM session info
        var lastfm_username = obj.session.name,
            lastfm_session = obj.session.key;
        User.find(req.user.id).success(function(user) {
            user.lastfm_user = lastfm_username;
            user.lastfm_session = lastfm_session;
            user.lastfm_scrobble = true;
            user.save()
            .success(function() {
                res.redirect('/');
            });
        });
    });
});
app.get('/lastfm/deauth', isLoggedIn, function(req, res) {
    User.find(req.user.id).success(function(user) {
        user.lastfm_user = '';
        user.lastfm_session = '';
        user.lastfm_scrobble = false;
        user.save()
        .success(function() {
            res.redirect('/');
        });
    });
});

// Sync the db schema
db.sync()
.success(function() {
    // Index the library
    updateIndex();
});
// Start the server
app.listen(8081);

// -- Indexes the music library
function updateIndex() {
    // Use `find` to get a list of all files recursively in library_path
    execFile('find', [ library_path, '-type', 'f' ], function(err, stdout, stderr) {
        var file_list = stdout.split('\n');
        file_list.pop(); // removes current dir from file_list
        file_list.forEach(function(filename, i) {
            console.log("Indexing " + filename);

            // bail if we've found an invalid extension
            var extension = path.extname(filename).toLowerCase();
            if (valid_extensions.indexOf(extension) < 0) {
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
                Track.findOrCreate({ id: id }, track_data)
                .success(function(track, created) {
                    if (created) {
                        console.log("Created " + track.title);
                    } else {
                        console.log("Indexed " + track.title);
                    }
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
    Track.findAll({
        where: ["title LIKE " + qs + " OR artist LIKE " + qs + " OR album LIKE " + qs],
        order: 'album ASC, track_num ASC, title ASC'
    })
    .success(function(tracks) {
        then(tracks);
    });
}

// -- Misc Helpers
function getLastFMParams(params) {
    params.api_sig = getLastFMSignature(params);
    return params;
}
function getLastFMSignature(params) {
    var sig = "",
        keys = Object.keys(params).sort();

    keys.forEach(function(k) {
        if (params.hasOwnProperty(k)) {
            sig = sig + k + params[k];
        }
    });
    return crypto.createHash('md5').update(sig + lastfm_secret).digest('hex');
}
function lastFMMarkNowPlaying(track, user) {
    if (!user.lastfm_scrobble || user.lastfm_session == '') {
        return;
    }

    var params = {
        api_key: lastfm_key,
        sk: user.lastfm_session,
        method: 'track.updateNowPlaying',
        artist: track.artist,
        track: track.title,
        album: track.album,
        trackNumber: track.track_num,
    };
    request.post({
        url: 'http://ws.audioscrobbler.com/2.0/?format=json',
        form: qs.stringify(getLastFMParams(params)),
    }, function(err, response, body) {
        var obj = JSON.parse(body),
            error = obj.error;

        if (!error) {
            console.log("LastFM: Marked as now playing, track " + track.id + " - " + track.title);
        } else {
            console.log("LastFM Error: " + obj.message);
        }
    });
}

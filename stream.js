var express = require('express'),
    lame = require('lame'),
    fs = require('fs'),
    jade = require('jade'),
    file = require('file'),
    path = require('path'),
    id3 = require('id3js'),
    execFile = require('child_process').execFile;
var app = express(),
    library = [],
    valid_extensions = [ '.mp3', '.wav', '.m4a', '.ogg' ];

// -- Stream Configuration
var library_path = '/home/cperrone/music/';

// -- Setup Express
app.use(express.static(__dirname + '/static/'));
app.use(express.bodyParser());
app.set('views', __dirname + '/templates/');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
    res.render('index', {
        pageTitle: 'Streaming Library',
        library: library,
    });
});

// -- Non-static Express Endpoints
app.all('/play/:track', function(req, res) {
    req.connection.setTimeout(750000); // 15 minutes

    var filename = library[req.params['track']]['path'];
    console.log("Reading file " + filename);
    try {
        fs.readFile(filename, function(err, data) {
            if (err) throw err;
            res.type('audio/mpeg');
            res.send(data);
        });
    } catch (e) {
        console.error('Could not find file');
    }
});

// -- Index Audio Library
execFile('find', [ library_path, '-type', 'f' ], function(err, stdout, stderr) {
    var file_list = stdout.split('\n');
    file_list.pop(); // removes current dir from file_list
    file_list.forEach(function(filename, i) {
        console.log("Indexing " + filename);

        // bail if we've found an invalid extension
        var extension = path.extname(filename).toLowerCase();
        if (valid_extensions.indexOf(extension) < 0) {
            console.log("Invalid extension " + extension + " found");
            return;
        }

        // save in library
        library[i] = {
            path: filename,
            base: path.basename(filename),
            rel: path.relative(library_path, filename),
            tags: { },
        };

        var track_tags = { };

        // get id3 tags
        id3({ file: filename, type: id3.OPEN_LOCAL }, function (err, id3_tags) {
            if (!err) {
                library[i].tags.title = id3_tags.title;
                library[i].tags.artist = id3_tags.artist;
                library[i].tags.album = id3_tags.album;
            } else {
                console.log(err);
            }
        });

    });

    // -- Start the server once we're done indexing
    app.listen(8081);
});


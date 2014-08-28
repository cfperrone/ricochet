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
    artists = { },
    albums = { },
    valid_extensions = [ '.mp3', '.wav', '.m4a', '.ogg' ];

// -- Stream Configuration
var library_path = '/home/cperrone/music/',
    library_file = library_path + 'library.json';

// -- Setup Express
app.use(express.static(__dirname + '/static/'));
app.use(express.bodyParser());
app.set('views', __dirname + '/templates/');
app.set('view engine', 'jade');

app.get('/', function(req, res) {
    res.render('index', {
        pageTitle: 'Streaming Library',
        library: library
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

function getFullLibraryByAlbum() {
    var tmp_lib = [];
    Object.keys(albums).forEach(function(key) {
        var album = albums[key];
        Object.keys(album).forEach(function(track_num) {
            var song_id = album[track_num];
            tmp_lib.push(library[song_id]);
        });
    });
    return tmp_lib;
}
function getFullLibraryByArtist() {
    var tmp_lib = [];
    Object.keys(artists).forEach(function(key) {
        var artist = artists[key];
        artist.forEach(function(track_num, j) {
            tmp_lib.push(library[track_num]);
        });
    });
    return tmp_lib;
}

// -- Read and parse the library file
var library_data = fs.readFileSync(library_file),
    full_library = JSON.parse(library_data),
    songs = full_library.songs,
    artists = full_library.artists,
    albums = full_library.albums;

// -- Go through each song, add more path info and add to node library
songs.forEach(function(song, i) {
    var filename = song.path;

    library[i] = {
        path: filename,
        base: path.basename(filename),
        rel: path.relative(library_path, filename),
        tags: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            track: song.track,
            duration: song.duration
        }
    };
});

app.listen(8081);

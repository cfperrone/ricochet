//stream.js

var PLAYER = $('audio.player'),
    CONTROLS = $('.controls'),
    UP_NEXT = $('.controls .up_next'),
    UP_NEXT_LIST = $('.controls .up_next .list'),
    UP_NEXT_ARROW = $('.controls .up_next .arrow'),
    playlist = [ ],
    position = 0;

$('.library .track').click(function() {
    // setup playlist
    playlist = $(this).nextAll().andSelf().toArray();
    console.log(playlist.length + " left");

    playTrack($(this));
});

function playTrack(obj) {
    var name=obj.data('track_id');

    PLAYER.attr('src', '/play/' + name);
    PLAYER.trigger('play');

    setControlsInfo(obj);
}

// every 250ms, update the progress bar
var progressInterval = setInterval(function() {
    var player = PLAYER.get(0),
        bar = CONTROLS.find('.progress'),
        cur = player.currentTime,
        dur = player.duration,
        playing = !player.paused,
        width = 0,
        screenWidth = CONTROLS.width();

    if (playing) {
        width = Math.ceil(cur/dur * screenWidth);
    }
    bar.css('width', width + "px");
}, 250);

PLAYER.on('ended', function() {
    var next = playlist[++position];
    playTrack($(next));
});

// places the track name into the floating control module
function setControlsInfo(obj) {
    var html = obj.html();
    CONTROLS.find('.track').fadeOut(500, function() {
        $(this).html(html).fadeIn(500);
    });

    UP_NEXT_LIST.html($(playlist).slice(position, position+10).clone());
    UP_NEXT_LIST.find('.track').each(function() {
        if (obj.data('track_id') == $(this).data('track_id')) {
            $(this).addClass('selected');
        } else {
            $(this).removeClass('selected');
        }
    });

    $('.controls .track').click(function() {
        // setup playlist
        playlist = $(this).nextAll().andSelf().toArray();
        console.log(playlist.length + " left");

        playTrack($(this));
    });
}

UP_NEXT_ARROW.click(function(obj) {
    if (UP_NEXT_LIST.is(':visible')) {
        UP_NEXT_LIST.slideUp();
    } else if (UP_NEXT_LIST.html() != "") {
        UP_NEXT_LIST.slideDown();
    }
});

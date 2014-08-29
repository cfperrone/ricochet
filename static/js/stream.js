//stream.js

var PLAYER = $('audio.player'),
    p = PLAYER.get(0),
    CONTROLS = $('.controls'),
    CONTROLS_PLAY = CONTROLS.find('.play'),
    CONTROLS_NEXT = CONTROLS.find('.next'),
    CONTROLS_PREV = CONTROLS.find('.prev'),
    PROGRESS = $('.progress'),
    NOW_PLAYING = $('.now-playing'),
    DURATION = $('.controls .duration'),
    playing = null,
    position = 0;

$('.library .track').click(function() {
    playTrack($(this));
});

function playTrack(obj) {
    // If the object is empty
    if (obj.length == 0) {
        stopPlayback();
        return;
    }

    // Configure the audio tag
    PLAYER.attr('src', '/play/' + obj.data('track_id'));
    PLAYER.trigger('play');

    // Set the global playing track
    playing = obj;
    setControlsInfo(obj);
}
function nextTrack() {
    var next = $(playing).next();
    return next;
}
function prevTrack() {
    var prev = $(playing).prev();
    return prev;
}
function stopPlayback() {
    playing = null;

    // Actually stop the audio tag
    PLAYER.trigger('pause');
    PLAYER.attr('src', '');
    setControlsInfo(null);

    // Clear the now playing bar
    //NOW_PLAYING.fadeOut(500);

    // Clear the now playing row
    $('.library tr.info').removeClass('info');
}

// every 250ms, update the progress bar and duration clock
var progressInterval = setInterval(function() {
    var bar = PROGRESS,
        cur = p.currentTime,
        dur = p.duration,
        playing = !p.paused,
        width = 0,
        screenWidth = 100;

    width = cur/dur * screenWidth;
    bar.animate({
        'width': width + '%',
    }, 100);

    var displayTime = formatSeconds(cur),
        clock = DURATION;
    clock.html(displayTime);

}, 250);

// Audio Player Events
PLAYER.on('ended', function() {
    nextTrack();
});
PLAYER.on('pause', function() {
    CONTROLS.find('.play').removeClass('fa-pause').addClass('fa-play');
});
PLAYER.on('play', function() {
    CONTROLS.find('.play').removeClass('fa-play').addClass('fa-pause');
});
PLAYER.on('ended', function() {
    PROGRESS.css('width', '0%');
    CONTROLS.find('.play').removeClass('fa-pause').addClass('fa-play');
});

// Control button events
CONTROLS_PLAY.click(function() {
    var p = PLAYER.get(0);
    if (p.paused == true) {
        p.play();
    } else {
        p.pause();
    }
});
CONTROLS_NEXT.click(function() {
    playTrack(nextTrack());
});
CONTROLS_PREV.click(function() {
    playTrack(prevTrack());
});

// Keyboard events
Mousetrap.bind('space', function() {
    CONTROLS_PLAY.trigger('click');
});

// places the track name into the floating control module
function setControlsInfo(obj) {
    if ($.isEmptyObject(obj)) {
        var track_title = "",
            track_artist = "";
    } else {
        var track_title = obj.data('track_title'),
            track_artist = obj.data('track_artist');
    }
    NOW_PLAYING.fadeOut(500, function() {
        $(this).find('.title').html(track_title);
        $(this).find('.artist').html(track_artist);
        $(this).fadeIn(500);
    });

    // Update the row color for the currently playing track
    $('.library tr.info').removeClass('info');

    if (!$.isEmptyObject(obj)) {
        obj.addClass('info');
    }
}

function formatSeconds(input) {
    var sec_num = parseInt(input, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }

    if (hours == 0 ){
        return minutes + ':' + seconds;
    } else {
        return hours + ':' + minutes + ':' + seconds;
    }
}

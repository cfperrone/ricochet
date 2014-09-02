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
    REINDEX = $('#reindex'),
    ALERT_SUCCESS = $('#global-success'),
    ALERT_ERROR = $('#global-error'),
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
function getNextTrack() {
    var next = $(playing).next();
    return next;
}
function getPrevTrack() {
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
    playTrack(getNextTrack());
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
    playTrack(getNextTrack());
});
CONTROLS_PREV.click(function() {
    if (p.currentTime < 5) {
        playTrack(getPrevTrack());
    } else {
        playTrack(playing);
    }
});

// Settings buttons
REINDEX.click(function() {
    $.post('/server/reindex', function(data) {
        if (data == 'OK') {
            alertSuccess("Reindexing started");
        } else {
            alertError("Reindexing failed");
        }
    }).fail(function() {
        alertError("Reindexing failed");
    });
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
        var track_title = obj.find('.title').html(),
            track_artist = obj.find('.artist').html();
    }
    NOW_PLAYING.fadeOut(250, function() {
        $(this).find('.title').html(track_title);
        $(this).find('.artist').html(track_artist);
        $(this).fadeIn(250);
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

function alertSuccess(message) {
    ALERT_SUCCESS.html(message).fadeIn().delay(2000).fadeOut();
}
function alertError(message) {
    ALERT_ERROR.html(message).fadeIn().delay(2000).fadeOut();
}
ALERT_SUCCESS.hide();
ALERT_ERROR.hide();

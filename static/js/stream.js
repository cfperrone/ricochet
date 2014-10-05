//stream.js

var PLAYER = $('audio.player'),
    p = PLAYER.get(0),
    CONTROLS = $('.controls'),
    CONTROLS_PLAY = CONTROLS.find('.play'),
    CONTROLS_NEXT = CONTROLS.find('.next'),
    CONTROLS_PREV = CONTROLS.find('.prev'),
    CONTROLS_VOLUME = CONTROLS.find('.volume'),
    VOLUME_BAR = CONTROLS.find('.volumebar'),
    VOLUME_HANDLE = CONTROLS.find('.volumehandle'),
    PROGRESS = $('.progress'),
    NOW_PLAYING = $('.now-playing'),
    DURATION = $('.controls .duration'),
    REINDEX = $('#reindex'),
    ALERT_SUCCESS = $('#global-success'),
    ALERT_ERROR = $('#global-error'),
    TRACK_DROPDOWN = $('.track .dropdown-toggle'),
    TRACK_EDIT = $('.track .edit-track'),
    TRACK_REINDEX = $('.track .reindex-track'),
    MODAL_EDIT = $('#edit-modal'),
    MODAL_EDIT_SUBMIT = $('#edit-modal .submit'),
    SEARCH_QUERY = $('#search-query'),
    SEARCH_SUBMIT = $('#search-submit'),
    playing = null,
    changing_volume = false,
    position = 0;

// Initialize some bootstrap stuff
$('.dropdown-toggle').dropdown();
MODAL_EDIT.modal({ show: false });

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
function setVolume(perc) {
    // Set volume on audio element
    p.volume = perc;

    // Set volume icon
    CONTROLS_VOLUME.removeClass('fa-volume-down')
                   .removeClass('fa-volume-up')
                   .removeClass('fa-volume-off');
    if (perc > .65) {
        CONTROLS_VOLUME.addClass('fa-volume-up');
    } else if (perc > .05) {
        CONTROLS_VOLUME.addClass('fa-volume-down');
    } else {
        CONTROLS_VOLUME.addClass('fa-volume-off');
    }
}
setVolume(1);

function doTrackAction(obj, action, data) {
    if (obj.length == 0) {
        return;
    }

    if (typeof data == 'undefined') {
        data = { };
    }

    var url = '/play/' + obj.data('track_id') + '/' + action;

    // Perform the action and replace the row with a new render
    $.post(url, data, function(returnData) {
        obj.html($(returnData).html());
        initTrackDropdownEvents(obj);
    });
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
    // Increment play count for finished track
    doTrackAction(playing, 'increment');

    playTrack(getNextTrack());

    PROGRESS.css('width', '0%');
    CONTROLS.find('.play').removeClass('fa-pause').addClass('fa-play');
});
PLAYER.on('pause', function() {
    CONTROLS.find('.play').removeClass('fa-pause').addClass('fa-play');
});
PLAYER.on('play', function() {
    CONTROLS.find('.play').removeClass('fa-play').addClass('fa-pause');
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
CONTROLS_VOLUME.click(function() {
    VOLUME_BAR.toggle(0, function() {
        VOLUME_BAR.css('position', 'absolute');
    });
});
VOLUME_BAR.hide();

// Volume bar events
VOLUME_HANDLE.on('mousedown', function() {
    changing_volume = true;
});
$('body').on('mouseup', function() {
    if (changing_volume) {
        changing_volume = false;
    }
});
VOLUME_BAR.on('mousemove', function(event) {
    if (!changing_volume) {
        return false;
    }

    var posY = event.pageY - 35,
        height = VOLUME_BAR.height() - 5,
        minY = VOLUME_BAR.offset().top - 5,
        maxY = minY + height;

    if (posY >= minY && posY <= maxY) {
        var offset = posY - minY,
            perc = 1 - offset/height;

        // Set position of handle
        VOLUME_HANDLE.css('margin-top', (offset - 5) + 'px');

        // Set volume of audio element
        setVolume(perc);
    }

    return false;
});

// Search
SEARCH_SUBMIT.click(function(e) {
    e.preventDefault();
    var query = SEARCH_QUERY.val();

    $('.search-spinner').removeClass('hidden');
    $.get('/search/' + query, function(data) {
        $('.library').replaceWith(data);
        initTrackDropdownEvents($('.library .track'));
        $('.search-spinner').addClass('hidden');
    });

    return false;
});
SEARCH_QUERY.on('change keyup paste', function() {
    SEARCH_SUBMIT.trigger('click');
});

// Global settings buttons
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

// Track settings buttons
function initTrackDropdownEvents(obj) {
    // Re-initialize bootstrap dropdowns
    obj.find('.dropdown-toggle').dropdown();

    obj.find('.dropdown-toggle').click(function(e) {
        e.stopPropagation();
    });
    obj.find('.edit-track').click(function(e) {
        e.stopPropagation();

        // Populate track info
        var id = $(this).data('track_id');
        $.get('/play/' + id + '/data', function(data) {
            // Fill in the modal information
            MODAL_EDIT.find("input[type='text']").each(function() {
                var key = $(this).attr('name');
                if (key in data) {
                    $(this).val(data[key]);
                }
            });

            // Add the track id to the button
            MODAL_EDIT_SUBMIT.data('track_id', id);

            // Open the modal
            MODAL_EDIT.modal('show');
        })
        .fail(function() {
            alertError("Could not retrieve track info!");
        });
    });
}
initTrackDropdownEvents($('.library .track'));
MODAL_EDIT_SUBMIT.click(function() {
    // Save the data & update the row
    var form = MODAL_EDIT.find('form'),
        data = form.serialize(),
        id = $(this).data('track_id'),
        track = $('.library .track[data-track_id=\'' + id + '\']');
    doTrackAction(track, 'edit', data);

    // Close the modal
    MODAL_EDIT.modal('hide');
});

// Keyboard events
Mousetrap.bind('space', function() {
    CONTROLS_PLAY.trigger('click');
    return false;
});

// Adds track metadata to the bottom nav, highlights track row and more
function setControlsInfo(obj) {
    if ($.isEmptyObject(obj)) {
        var track_title = "",
            track_artist = "",
            title = "";
    } else {
        var track_title = obj.find('.title').html(),
            track_artist = obj.find('.artist').html(),
            title = track_artist + " - " + track_title;
    }
    NOW_PLAYING.fadeOut(250, function() {
        $(this).find('.title').html(track_title);
        $(this).find('.artist').html(track_artist);
        $(this).fadeIn(250);
    });

    setPageTitle(title);

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

function setPageTitle(title) {
    var e = $('head title'),
        tail = 'Ricochet';

    if (title == null || title == '') {
        e.html(tail);
    } else {
        e.html(title + ' | ' + tail);
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

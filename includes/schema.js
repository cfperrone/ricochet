var Sequelize = require('sequelize'),
    crypto = require('crypto'),
    moment = require('moment'),
    models = { };

module.exports = function(db, config, afterSync) {
    // -- Database Configuration
    models.Track = db.define('track', {
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

    models.User = db.define('user', {
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
                return (models.User.createPassword(input) === this.password);
            },
            canScrobble: function() {
                return (this.lastfm_session != '') && (this.lastfm_scrobble == true);
            }
        },
        classMethods: {
            createPassword: function(input) {
                return crypto.createHash('sha1').update(config.password_salt + input).digest('hex');
            }
        }
    });

    // Sync the db
    db.sync()
    .success(function() {
        afterSync();
    });

    return models;
}

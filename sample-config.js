module.exports.config = {
    // Server configuration
    port: 8081,
    password_salt: 'change-to-something-cool',
    root_url: 'http://localhost',

    // Music Indexing Configuration
    library_path: '/path/to/library',
    valid_extensions: [ '.mp3', '.wav', '.m4a', '.ogg' ],

    // LastFM Configuration
    lastfm_key: '',
    lastfm_secret: '',
}

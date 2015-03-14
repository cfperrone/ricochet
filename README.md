Ricochet
========

Ricochet is a private music streaming service. It uses Elasticsearch and has support for Last.fm scrobbling.

Prerequisites
-------------
* [Node.js](https://nodejs.org)
* [Elasticsearch](https://www.elastic.co/products/elasticsearch)
* Node packages (all available from npm and installed via `npm install`)
  * [Express](http://expressjs.com)
  * [Jade](https://www.npmjs.com/package/jade)
  * [musicmetadata](https://github.com/leetreveil/musicmetadata)
  * [Sequelize](http://docs.sequelizejs.com/en/latest/)
  * [request](https://github.com/request/request)
  * [Passport](http://passportjs.org/)
  * [elasticsearch-js](https://github.com/elastic/elasticsearch-js)
  * [Moment.js](http://momentjs.com/)

Installation
------------
1. Clone the repository.
2. Run `npm install` in the repository directory.
3. Copy sample-config.js to config.js and edit as appropriate.

Running
-------
`node stream.js`

Configuration Options
---------------------
There are no default configuration options. All of the following must be specified in config.js.

Option  | Description
------- | -----------
port    | The port which the web server will run on.
password_secret | A secret string that we will include when hashing & salting passwords. Don't know what salting is? [Learn.]( http://en.wikipedia.org/wiki/Salt_(cryptography))
library_path | The directory where your music is stored. When the server is started it will recursively index all music in this directory. You can organize your music into folders -- it doesn't affect indexing.
valid_extensions | File extensions for music to index. Ricochet only supports ID3 tagging for auto-populating metadata at the moment.
lastfm_key | Your Last.fm API key
lastfm_secret | Your Last.fm API Secret

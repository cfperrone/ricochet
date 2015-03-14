// This script creates new user accounts.
// Usage: node utils/create_account.js <user_id> <username> <password> <email_address>

var Sequelize = require('sequelize');
var db = new Sequelize('ricochet', 'stream', 'lolwat', {
        logging: false
    }),
    config = require('../config.js').config,
    Schema = require('../includes/schema.js');

var models = Schema(db, config, function() { });

var args = process.argv.slice(2);
if (args.length != 4) {
    console.log("Usage: node utils/create_account.js <user_id> <username> <password> <email_address>");
    process.exit();
}

var id = parseInt(args[0]),
    username = args[1],
    salt = models.User.generateSalt(),
    password = models.User.createPassword(args[2], salt),
    email = args[3];

var user = models.User.findOrCreate(
    {
        username: username
    },
    {
        id: id,
        username: username,
        password: password,
        salt: salt,
        email_address: email
    })
    .spread(function(user, created) {
        if (created == true) {
            console.log("A new user was created with id " + user.id);
        } else {
            console.log("The user " + user.username + " already exists");
        }
    });


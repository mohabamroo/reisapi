var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
require('mongoose-type-email');

var userSchema = mongoose.Schema({
	username: {
		type: String,
		index: true, 
		unique: true,
		required: true
	},
	name: String,
	password: {
		type: String
	},
	public: {type: Boolean, default: true},
	birthdate: {
		type: String
	},
	location: {
		lat: String,
		lng: String
	},
	gender: String,
	usertype: String,
	email: {
		type: mongoose.SchemaTypes.Email
	},

	photos: [
		{
			name: {
				type:String
			},
			src: {
				type:String
			}
		}
	],
	bio: {
		type: String
	},
	profilephoto: {
		type: String
	},
	phone: {
		type: String
	},
	verificationCode: {
		type: String
	},
	stickers: [
		{
			type: String
		}
	],
	home_city: String,
	current_city: String,
	languages: String

});

var User = module.exports = mongoose.model('User', userSchema);

module.exports.createUser = function(newUser, callback) {
	bcrypt.genSalt(10, function(err, salt) {
	    bcrypt.hash(newUser.password, salt, function(err, hash) {
	        newUser.password = hash;
	        newUser.save(callback);
	    });
	});
}

module.exports.getUserbyUsername = function(username, callback) {
	User.findOne({username: username}, callback);
}

module.exports.getUserById = function(userid, callback) {
	User.findById(userid, callback);
}

module.exports.validatePassword = function(givenpassword, hash, callback) {
	bcrypt.compare(givenpassword, hash, function(err, res) {
	    if(err) {
	    	console.log(err);
	    	throw err;
	    } 
	    callback(null, res);
	});
}


var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var User = require('../../models/user');

var apiController = require('../../controllers/apiController');
var multer  = require('multer');
var mailer = require('express-mailer');
var app = require('../../app.js');
var randomstring = require("randomstring");
var jwt = require('jsonwebtoken');
var profilephotoUpload = multer().single('profilePhoto');

var printError = apiController.printError;
var clientS3 = apiController.clientS3;
var printResult = apiController.printResult;
var ensureAdmin = apiController.ensureAdmin;
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi;
var uniqueName = apiController.uniqueName;
var newtoken = apiController.newtoken;

passport.use(new LocalStrategy(
	function(username, password, done) {
		User.getUserbyUsername(username, function(err, user) {
			if(err)
				throw err;
			if(!user) {
				console.log("Unknown user");
				return done(null, false, {message: 'Unknown User'});
			}
		User.validatePassword(password, user.password, function(err, res) {
			if(err)
				throw err;
			if(res==true) {
				console.log("okay password");
				return done(null, user);
			} else {
				console.log("Invalid password");
				return done(null, false, {message: 'Invalid password'});
			}
		});
   });

}));

passport.serializeUser(function(user, done) {
	// saves user in req
	done(null, user.id);

});

passport.deserializeUser(function(id, done) {
	User.getUserById(id, function(err, user) {
		done(err, user);
	});

});

router.post('/signin',
	passport.authenticate('local',
		{session: true, successRedirect: '/api/users/loginSuccess', failureRedirect: '/api/users/loginFail'}),
	function(req, res, next) {
	}
);

function ensureUniqueUsername(req, res, next) {
	var username = req.newUser.username;
	User.getUserbyUsername(username, function(err, findRes) {
		if(findRes!=null) {
			res.status(400).json({
				success: false,
				errors: [{"msg":'Duplicate username!\nUse different username.'}]
			});
		} else {
			next();
		}
	});

}

function ensureUniqueEmail(req, res, next) {
	var email = req.newUser.email;
	User.findOne({email: email}, function(err, findRes) {
		if(findRes!=null) {
			res.status(400).json({
				success: false,
				errors: [{"msg":'Duplicate Email!\nUse different email.'}]
			});
		} else {
			next();
		}
	});

}

router.get('/loginSuccess', function(req, res) {
	req.user.password = "";
	req.user.verificationCode = "";
	if(req.isAuthenticated()) {
		var token = jwt.sign({
		  user: req.user
		}, 'ghostrider', { expiresIn: '1000h'});
		res.json({
			success: true,
			token: token,
			msg: "Signed in successfully!"
		});
	} else {
		res.json({
			success: false,
			user: null,
			msg: "Not logged in, try again!"
		});
	}

});

function getUser(req, res, next) {
	var username = req.body.username;
	User.getUserbyUsername(username, function(err, user) {
		if(!printError(err, req, res)) {
			if(user==null||!user) {
				console.log("Unknown user");
				res.status(404).json({
					success: false,
					errors: [{"msg":"User not found. wrong username."}]
				});
			} else {
				req.user = user;
				next();
			}
		}
	});
}

function validateUser(req, res, next) {
	var password = req.body.password;
	User.validatePassword(password, req.user.password, function(err, result) {
		if(!printError(err, req, res)) {
			if(result==true) {
				req.user.password = "";
				next();
			} else {
				res.status(401).json({
					success: false,
					errors: [{"msg":"Wrong password."}]
				});
			}		
		}
	});
}

function validateLoginInputs(req, res, next) {
	var password = req.body.password;
	var username = req.body.username;
	if(!username||!password) {
		res.status(400).json({
			success: false,
			errors: [{"msg":"missing inputs."}]
		});
	} else {
		next();
	}
}
router.post('/login', validateLoginInputs, getUser, validateUser, function(req, res) {
	var token = jwt.sign({
	  user: req.user
	}, 'ghostrider', { expiresIn: '1000h'});
	res.status(200).json({
		success: true,
		token: token,
		msg: "Signed in successfully!"
	});
		
});

router.post('/currentUser', ensureAuthenticatedApi, function(req, res) {
	res.json(req.decoded);

});

router.get('/loginFail', function(req, res) {
	res.json({
		success: false,
		user: null,
		msg: "Wrong username/password!"
	});
	
});

router.post('/logout', function(req, res){
	if(req.isAuthenticated()){
		req.logout();
		res.json({
			success: true,
			msg: "User logged out."
		});
	} else {
		res.json({
			success: false,
			msg: "There is no user logged in!"
		});
	}

});

function validateErrors(req, res, next) {
	req.checkBody('email', 'Email is empty!').notEmpty();
	req.checkBody('password', 'Password is empty!').notEmpty();
	req.checkBody('username', 'Username is empty!').notEmpty();
	if(req.body.password != null && req.body.confirmpassword != null) {
		req.checkBody('confirmpassword', 'Passwords do not match!').equals(req.body.password);
	}
	errors = req.validationErrors();
	if(errors) {
		errors.forEach(function(error) {
			printError(error, req, res);
		});
		res.json({
			success: false,
			msg: "Please try again",
			data: errors
		});
	} else
		next();
}

function appendNewUserObj(req, res, next) {
	var username = req.body.username;
	var password = req.body.password;
	var email = req.body.email;
	var name = req.body.name;
	var birthdate = req.body.birthdate;
	var rand = randomstring.generate();
	req.rand = rand;
	var newUser = new User({
		name: name,
		email: email,
		username: username,
		password: password,
		usertype: 'normal',
		birthdate: birthdate,
		bio: "No bio", 
		phone: "No phone",
		profilephoto: "http://s3-api.us-geo.objectstorage.softlayer.net/users-images/default-photo.jpeg",
		verificationCode: rand,
		stickers: [],
	});
	req.newUser = newUser;
	next();
}

function createNewUser(req, res, next) {
	var newUser = req.newUser;
	var rand = req.rand;
	User.createUser(newUser, function(err, user) {
		// printError(err, req, res, next);
		if(err) {
			res.status(400).json({
				success: false,
				errors: [err]
			});
		} else {
			var host = req.get('host');
			var link = "http://"+req.get('host')+"/users/verify/"+newUser.id+"/"+rand;
				app.mailer.send('email', {
			      to: newUser.email,
			      subject: 'Community <DON\'T REPLY> Email Verification',
			      link: link,
			      name: newUser.username
			    }, function (errEmail) {
			        printError(errEmail, req, res);
			        if(!printError(errEmail, req, res)) {
						req.newUser = user;
						next();
			        } else {
				        res.json({
				        	success: false,
				        	errors: [errEmail]
				        });	
			        }
			    });	
			
		}
			
	});
}

// info required: useername, email, password, confirmpassowrd
router.post('/signup', validateErrors, appendNewUserObj,
	ensureUniqueUsername, ensureUniqueEmail, createNewUser, function(req, res) {
	res.json({
		success: true,
		msg: 'You signed up successfully! Please, check and verify your email.',
	}).status(200);
	
});

router.get('/getStatus', function(req, res) {
	if(req.isAuthenticated())
		res.json({status: true});
	else
		res.json({status: false});

});

// use the new token!
// error validation?
router.post('/update', ensureAuthenticatedApi, function(req, res) {
	User.findById(req.decoded.user._id, function(err, user) {
		var phone = req.body.phone || user.phone;
		var bio = req.body.bio || user.bio;
		var public = req.body.public || user.public;
		var first_name = req.body.first_name || user.first_name;
		var location = req.body.location || user.location;
		var last_name = req.body.last_name || user.last_name;
		var birthdate = req.body.birthdate || user.birthdate;
		var home_city = req.body.home_city || user.home_city;
		var current_city = req.body.current_city || user.current_city;
		var profilephoto = req.body.profilephoto || user.profilephoto;
		var languages = req.body.languages || user.languages;
		var gender = req.body.gender || user.gender;
		var lat = req.body.lat || user.location.lat;
		var lng = req.body.lng || user.location.lng;
		User.findOneAndUpdate(
		  {_id: req.decoded.user._id},
		  { $set: 
				{	phone: phone,
					birthdate: birthdate,
					gender: gender,
					bio: bio,
					first_name: first_name,
					last_name: last_name,
					home_city: home_city,
					current_city: current_city,
					languages: languages,
					public: public,
					profilephoto: profilephoto,
					location: {lat: lat, lng: lng}
				}}, {new: true}, function(err, updatedUser) {
					printError(err, req, res);
					if(req.body.tags!=null&&req.body.tags!="")
						addTags(req, res, oldTags, function() {
							newtoken(res, updatedUser);
						});
					else
						newtoken(res, updatedUser);
				}
		);
	})

});

// authenticated?
router.get('/profile/:username', function(req,res) {
	User.findOne({username: req.params.username}, {password:0, verificationCode:0, _id:0},
	function(err, resuser) {
	    if(!resuser) {
	    	res.status(400).json({
	    		success: false,
	    		errors: [{"msg":"User doesn't exist."}]
	    	});
	    	return;
	    }
		var Bdate = resuser.birthdate;
	    var Bday = +new Date(Bdate);
	    var Q4A = ~~ ((Date.now() - Bday) / (31557600000));
	    var dude = resuser;
	    dude.age = Q4A;
		if(resuser.public==true) {
			res.status(200).json({
				success: true,
				data: dude
			});
		} else {
			res.status(403).json({
				success: false,
				errors: [{"msg":"Private profile."}]
			});
		}				
	});
    
});
router.get('/search/:username', function(req, res) {
	User.find({$or: [
			{username: {'$regex': '.*'+req.params.username+'.*'}},
			{email: {'$regex': '.*'+req.params.username+'.*'}},
		]}, function(err, results) {
		if(!printError(err, req, res)) {
			res.status(200).json(results);
		}
	});
});


module.exports = router;
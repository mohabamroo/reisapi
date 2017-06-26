var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var path = require("path");
var userUploadsPath = path.resolve(__dirname, "user_uploads");
var User = require('../../models/user');

var apiController = require('../../controllers/apiController');
var multer  = require('multer');
var mailer = require('express-mailer');
var app = require('../../app.js');
var randomstring = require("randomstring");
var storagetype = "screenshot";
var FileReader = require('filereader')
var Busboy = require('busboy');
var jwt = require('jsonwebtoken');
var inspect = require('util').inspect;
var fs = require('fs');
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
	console.log("serializeUser: "+user);
	done(null, user.id);

});

passport.deserializeUser(function(id, done) {
	console.log("deserializeUser: "+id);
	User.getUserById(id, function(err, user) {
		done(err, user);
	});

});

router.post('/signin',
	passport.authenticate('local',
		{session: true, successRedirect: '/api/user/loginSuccess', failureRedirect: '/api/user/loginFail'}),
	function(req, res, next) {
	}
);

function ensureUniqueUsername(req, res, next) {
	var username = req.newUser.username;
	console.log("username: "+username)
	User.getUserbyUsername(username, function(err, findRes) {
		console.log("user find res: "+findRes)
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
		console.log("find res email: "+findRes)
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

// router.use(ensureAuthenticated);

router.post('/login',
	passport.authenticate('local',
	{successRedirect: '/api/user/loginSuccess', failureRedirect: '/api/user/loginFail'})
);

router.get('/loginSuccess', function(req, res) {
	console.log("success");
	console.log("auth: "+req.isAuthenticated());
	req.user.password = "";
	req.user.verificationCode = "";
	console.log("users in backend: "+req.user);
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
	// var name = req.body.newUser.name;
	var email = req.body.email;
	var password = req.body.password;
	var username = req.body.username;
	// var birthdate = req.body.newUser.birthdate;
	// var phone = req.body.newUser.phone || "No number";
	var rand = randomstring.generate();
	req.rand = rand;
	var newUser = new User({
		// name: name,
		email: email,
		username: username,
		password: password,
		// usertype: type,
		// birthdate: birthdate,
		summary: "No summary", 
		phone: "No phone",
		profilephoto: "http://s3-api.us-geo.objectstorage.softlayer.net/users-images/default-photo.jpeg",
		organizations: [],
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
			})
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
	}, status=200);
	
});

router.get('/getStatus', function(req, res) {
	if(req.isAuthenticated())
		res.json({status: true});
	else
		res.json({status: false});

});

// edit profile
router.get('/profile/:id', ensureAuthenticatedApi, function(req, res) {
	if(req.isAuthenticated() && req.user.id == req.params.id) {
		res.json({
			success: true,
			data: req.user,
		});
	} else {
		res.json({
			success: false,
			msg: 'You are not logged to edit your profile.'
		});
	}

});

router.post('/saveChanges', ensureAuthenticatedApi, function(req, res) {
	var phone = req.body.user.phone;
	var email = req.body.user.email;
	var summary = req.body.user.userDesc;
	var birthdate = req.body.user.birthdate;
	var gender = req.body.user.gender;
	var oldTags = req.body.user.tags;
	var tagsArr = req.body.tags.split(', ');
	var newTags = oldTags.concat(tagsArr);
	newTags = newTags.filter(function(elem, index, self) {
	    return index == self.indexOf(elem);
	});
	User.findOneAndUpdate(
	  {_id: req.decoded.user._id},
	  { $set: 
			{	phone: phone,
				email: email,
				summary: summary,
				year: year,
				major: major,
				birthdate: birthdate,
				gender: gender,
				tags: newTags
			}}, {new: true}, function(err, updatedUser) {
				printError(err, req, res);
				if(req.body.tags!="")
					addTags(req, res, oldTags, function() {
						console.log("hnady new token");
						newtoken(res, updatedUser);
					});
				else
					newtoken(res, updatedUser);
			}
	);

});

function addTags(req, res, oldTags, next) {
	if(req.body.tags!="") {
		var tagsStr = req.body.tags;
		var tagsArr = tagsStr.split(', ');
		User.getUserbyUsername(req.body.user.username, function(err, user) {
			var oldTags = user.tags;
			tagsArr.forEach(function(tag) {
				var userToAdd = {name: user.username, profileid: user.id, photo: user.profilephoto};
				Tag.getTagbyTagname(tag, function(err2, tagres) {
					console.log("tag res: "+tagres);
					if(tagres!=null) {
						if(tagres.users.length>0)
						var userFound = tagres.users.filter(function(item) {
							return item.profileid == user.id;
						});
						console.log("userFound: "+userFound);
						Tag.update({_id: tagres.id}, {$push: {users: userToAdd}}, function(errpush, pushRes) {
							printError(errpush, req, res);
							printResult(pushRes);
							next();
						});
					} else {
						var newTag = new Tag({tag: tag, users: [userToAdd]});
						Tag.createTag(newTag, function(err3, resnewtag) {
							printError(err3, req, res);
							printResult(resnewtag);
							next();
							
						});
					}
				});
				
			});
		});	
	} else
		next();
}

function deleteTags(req, res, next) {
	console.log("deleteTags");
	var limit = req.decoded.user.tags.length;
	console.log("limit: "+limit);
	var index = 0;
	req.decoded.user.tags.forEach(function(tagname) {
		console.log(tagname);
		Tag.findOneAndUpdate(
		    {tag: tagname}, 
		    { $pull: { "users" : { profileid: req.decoded.user._id } } }, {new: true},
			function(err, updateRes) {
				printError(err, req, res);
				printResult(updateRes);
				if(updateRes.users.length==0) {
					Tag.remove({_id: updateRes._id}, function(err, removeRes) {
						printError(err, req, res);
						printResult(removeRes);
					});
				}
				index++;
				if(limit==(index))
					next();
			}
		);

	});
}

// NOTE: delete user from Tag document
router.post('/deleteTags', ensureAuthenticatedApi, deleteTags, function(req, res) {
	var token;
	User.findOneAndUpdate({_id: req.decoded.user._id}, {$set: {"tags": []}}, {new: true}, function(err1, updatedUser) {
		printError(err1, req, res);
		printResult(updatedUser.tags);
		token = jwt.sign({
		  user: updatedUser
		}, 'ghostrider', { expiresIn: '1000h'});
		res.json({
			success: true,
			msg: "Deleted tags!",
			token: token
		});
	});

});

router.get('/viewprofile/:id', function(req,res) {
	User.getUserById(req.params.id, function(err, resuser) {
		printError(err, req, res);
		var Bdate = resuser.birthdate;
	    var Bday = +new Date(Bdate);
	    var Q4A = ~~ ((Date.now() - Bday) / (31557600000));
	    var dude = resuser;
	    dude.age = Q4A;
		if(resuser.usertype=="student") {
			res.json({
				success: true,
				data: dude
			});
		} else {
			if(resuser.usertype=="club") {
				res.redirect('/clubs/viewClub/'+req.params.id);
			} else {
				if(resuser.usertype==="admin") {
					res.redirect('/users/admin');
				}
			}
		}				
	});
    
});


router.post('/updateProfilePhoto', ensureAuthenticatedApi, profilephotoUpload, function(req, res) {
    var file = req.file;
    console.log("file: "+file);
    if(!file) {
		res.status(400).json({
			success: false,
			msg: "No file attached",
			errors: [{"msg": "No file attached."}]
		});
    }
	var newfilename = uniqueName(req, file.originalname);
	console.log(newfilename)
	var bucketName = "users-images";
	var data = {
		Bucket: bucketName,
		Key: newfilename,
		Body: file.buffer,
		ACL: "public-read"
	};
	console.log(data)
	clientS3.putObject(data, function(err, data) {
		printError(err, req, res);
		var url = "http://s3-api.us-geo.objectstorage.softlayer.net/";
		url += bucketName + "/" + newfilename;
		console.log(url);
		console.log(req.decoded.user._id);
		User.findOneAndUpdate({_id: req.decoded.user._id}, {$set: {profilephoto: url}}, function(err, updatedUser) {
			console.log(updatedUser);
			if(err) {
				res.status(500).json({
					success: false,
					errros: [err]
				});
			} else {
				var token = jwt.sign({
				  user: updatedUser
				}, 'ghostrider', { expiresIn: '1000h'});
				res.status(200).json({
					success: true,
					msg: "File uploaded!",
					token: token
				});
			}
			
		});
	});

});
module.exports = router;
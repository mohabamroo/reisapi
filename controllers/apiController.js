var mongoose = require('mongoose');
var s3 = require('s3');
var jwt = require('jsonwebtoken');

var client = s3.createClient({
	maxAsyncS3: 20, // this is the default
	s3RetryCount: 3, // this is the default
	s3RetryDelay: 1000, // this is the default
	multipartUploadThreshold: 20971520, // this is the default (20 MB)
	multipartUploadSize: 15728640, // this is the default (15 MB)
	s3Options: {
	accessKeyId: "VzyHvuxyGi5QuskCbmpB",
	secretAccessKey: "zeZwg7nQMTVlDyweCBGDJDNPReIFAC8OJ18CxczI",
	region: "us-standard",
	endpoint: 's3-api.us-geo.objectstorage.softlayer.net',
	sslEnabled: true
	// any other options are passed to new AWS.S3()
	// See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
	}
});
var clientS3 = client.s3;

module.exports.clientS3 = clientS3; 

function printError(err, req, res) {
	if(err) {
		console.log(err);
		res.json({
			success: false,
			errors: [err]
		}).status(400);
		return true;
	}
}
module.exports.printError = printError;

module.exports.printResult = function(result) {
	console.log("Result: " + JSON.stringify(result));
}

module.exports.ensureAuthenticatedApi = function(req, res, next) {
	var token = req.body.token || req.body.query || req.headers['x-access-token'];
	if(token) {
		jwt.verify(token, 'ghostrider', function(err, decoded) {
			if(err)
				res.json({success: false, msg: "Error decoding your token!"});
			else {
				// console.log("hna:\n"+decoded.user._id);
				req.decoded = decoded;
				next();
			}
		});
	} else {
		res.status(401).json({success: false, msg: "No token provided!"});
	}
}

module.exports.uniqueName = function(req, filename) {
	var arr = filename.split(".");
  	var filetype = arr[arr.length-1];
  	var newfilename = req.decoded.user.username + '-' + Date.now()+'.'+filetype;
  	return newfilename;
}

module.exports.ensureAdmin = function(req, res, next) {
	if(req.isAuthenticated()) {
		console.log("code: "+req.user.verificationCode)
		if(req.user.verificationCode==="X3PpQxaOJ0k95CjnlmgAx2DXm8yHkAR") {
			return next();
		} else {
			req.flash('error_msg','You are not verified!\nOpen your GUC email and verify your account to continue');
			res.redirect('/users/signin');
		}
	} else {
		req.flash('error_msg','You are not logged in');
		res.redirect('/users/signin');
	}
}

module.exports.newtoken = function(res, updatedUser) {
	var token = jwt.sign({
	  user: updatedUser
	}, 'ghostrider', { expiresIn: '1000h'});
	res.json({
		success: true,
		token: token,
		msg: "Updated profile!"
	});
}

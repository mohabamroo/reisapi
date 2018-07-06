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
	if (err) {
		console.log(err);
		res.status(400).json({
			success: false,
			errors: [err]
		});
		res.end();
	} else {
		return false;
	}
}

module.exports.printError = printError;

module.exports.printResult = function (result) {
	console.log("Result: " + JSON.stringify(result));
}

module.exports.ensureAuthenticatedApi = function (req, res, next) {
	var token = req.body.token || req.body.query || req.headers['x-access-token'];
	if (token) {
		jwt.verify(token, 'ghostrider', function (err, decoded) {
			if (err)
				res.json({
					success: false,
					msg: "Error decoding your token!"
				});
			else {
				// console.log("hna:\n"+decoded.user._id);
				req.decoded = decoded;
				next();
			}
		});
	} else {
		res.status(401).json({
			success: false,
			msg: "No token provided!"
		});
	}
}

function appendAuth(req, res, next) {
	var token = req.body.token || req.body.query || req.headers['x-access-token'];
	if (token) {
		jwt.verify(token, 'ghostrider', function (err, decoded) {
			if (err)
				res.json({
					success: false,
					msg: "Error decoding your token!"
				});
			else {
				req.decoded = decoded;
				next();
			}
		});
	} else {
		next();
	}
}

module.exports.appendAuth = appendAuth;

module.exports.uniqueName = function (req, filename) {
	var arr = filename.split(".");
	var filetype = arr[arr.length - 1];
	var newfilename = req.decoded.user.username + '-' + Date.now() + '.' + filetype;
	return newfilename;
}

module.exports.ensureAdmin = function (req, res, next) {
	console.log(req.decoded.user)
	if (req.decoded.user.usertype === "admin" || true) {
		return next();
	} else {
		res.status(403).json({
			msg: "You are not an admin"
		});
	}

}

module.exports.newtoken = function (res, updatedUser) {
	var token = jwt.sign({
		user: updatedUser
	}, 'ghostrider', {
		expiresIn: '1000h'
	});
	res.json({
		success: true,
		token: token,
		msg: "Updated profile!"
	});
}

module.exports.validateErrors = function (req, res, next) {
	errors = req.validationErrors();
	if (errors) {
		res.status(400).json({
			success: false,
			msg: "Please try again",
			errors: errors
		});
	} else
		next();
}

module.exports.removeDuplicates = function(arr) {
    let unique_array = []
    for(let i = 0;i < arr.length; i++){
        if(unique_array.indexOf(arr[i]) == -1){
            unique_array.push(arr[i])
        }
    }
    return unique_array
}
var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var Album = require('../../models/album');
var Trip = require('../../models/trip');

var apiController = require('../../controllers/apiController');
var multer  = require('multer');
var mailer = require('express-mailer');
var app = require('../../app.js');
var randomstring = require("randomstring");
var jwt = require('jsonwebtoken');

var printError = apiController.printError;
var clientS3 = apiController.clientS3;
var printResult = apiController.printResult;
var ensureAdmin = apiController.ensureAdmin;
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi;
var uniqueName = apiController.uniqueName;
var newtoken = apiController.newtoken;
var validateErrors = apiController.validateErrors;
var appendAuth = apiController.appendAuth;

function validateTrip(req, res, next) {
	req.checkBody('title', 'No title provided!').notEmpty();
	validateErrors(req, res, next);
}

function createTrip(req, res, next) {
	var newTrip = new Trip({
		user: req.decoded.user._id,
		title: req.body.title,
		public: req.body.public || true,
		albums: []
	});
	newTrip.save(function(err, trip) {
		if(!printError(err, req, res)) {
			req.trip = trip;
			next();
		}
	});
}

// create trip
router.post('/create', ensureAuthenticatedApi, validateTrip, createTrip, validateAlbums, addAlbums, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.trip
	});
});

function checkTrip(req, res, next) {
	Trip.findById(req.params.tripId).populate({path: 'albums'}).exec(function(err, trip) {
		if(!printError(err, req, res)) {
			if(trip==null ||!trip) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Trip not found!"}]
				});
			} else {
				req.trip = trip;
				next();
			}
		}
	});
}

function checkTripAbs(req, res, next) {
	Trip.findById(req.params.tripId).exec(function(err, trip) {
		if(!printError(err, req, res)) {
			if(trip==null ||!trip) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Trip not found!"}]
				});
			} else {
				req.trip = trip;
				next();
			}
		}
	});
}

function verifyPublicOrOwner(req, res, next) {
	if(req.trip.public!=true || !req.decoded || !req.decoded.user._id==req.trip.user) {
		res.status(403).json({
			success: false,
			errors: [{"msg":"Private Trip."}]
		});
	} else {
		next();
	}
}

// view trip
router.get('/:tripId', checkTrip, appendAuth, verifyPublicOrOwner, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.trip
	});
});

function verifyOwnership(req, res, next) {
	userId = req.decoded.user._id;
	tripUser = req.trip.user;
	if(userId!=tripUser) {
		res.status(403).json({
			success: false,
			errors: [{"msg": "Not owner of this trip."}]
		});
	} else {
		next();
	}
}

function validatePostsNotEmpty(req, res, next) {
	req.checkBody('title', 'No posts provided!').notEmpty();
	validateErrors(req, res, next);
}

function validateAlbums(req, res, next) {
	if(!req.body.albums) {
		return next();
	}
	albums = req.body.albums;
	if(!Array.isArray(albums)) {
		albums = [albums];
	}
	var limit =  albums.length;
	var i = 0;
	albums.forEach(function(albumId) {
		console.log(albumId);
		if(req.trip.albums.indexOf(albumId) >= 0) {
			res.status(400).json({
				success: false,
				errors: [{"msg":"Duplicate albums in trip."}]
			});
			return;
		}
		Album.findById(albumId, function(err, albumRes) {
			if(req.error==true) {
				// returned error before, don't do anything
				return;
			}
			if(!err && albumRes!=null) {
				if(albumRes.user!=req.decoded.user._id) {
					req.error = true;
					res.status(404).json({
						success: false,
						errors: [{"msg":"One or more album don't belong to you."}]
					});
				}
				i++;
				if(i==limit) {
					// all posts found
					next();
				}
			} else {
				req.error = true;
				res.status(404).json({
					success: false,
					errors: [{"msg":"One (or more) album doesn't exist."}]
				});
			}
		});
	});
	req.albums = albums;

}

function addAlbums(req, res, next) {
	if(!req.body.albums) {
		return next();
	}
	Trip.findOneAndUpdate({_id: req.trip._id},
		{$pushAll: {albums: req.albums}}, {new: true},
	function(err, newTrip) {
		if(!printError(err, req, res)) {
			req.trip = newTrip;
			next();
		}
	});

} 

function validateAlbumsNotEmpty(req, res, next) {
	if(req.body.albums==null || req.body.albums==[]) {
		res.status(400).json({
			success: false,
			errors: [{"msg":"No albums provided."}]
		});
	} else {
		next();
	}
}

// add albums in trip
router.post('/add/:tripId', ensureAuthenticatedApi, checkTripAbs,
	verifyOwnership, validateAlbumsNotEmpty, validateAlbums, addAlbums, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.trip
	});
});

function removeAlbums(req, res, next) {
	albums = req.body.albums;
	if(!Array.isArray(albums)) {
		albums = [albums];
	}
	Trip.findOneAndUpdate({_id: req.trip._id},
		{$pullAll: {albums: albums}}, {new: true},
	function(err, newTrip) {
		if(!printError(err, req, res)) {
			req.trip = newTrip;
			next();
		}
	});
} 

// remove albums from trip
router.post('/remove/:tripId', ensureAuthenticatedApi, checkTrip,
	verifyOwnership, validateAlbumsNotEmpty, validateAlbums, removeAlbums, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.trip
	});
});

function removeTrip(req, res, next) {
	Album.remove({_id: req.trip._id}, function(err, removeRes) {
		if(!printError(err, req, res)) {
			next();
		}
	});
}

router.post('/delete/:tripId', ensureAuthenticatedApi, checkTrip,
	verifyOwnership, removeTrip, function(req, res) {
		res.status(200).json({
			success: true,
			msg: "Deleted Trip"
		});
});

module.exports = router;
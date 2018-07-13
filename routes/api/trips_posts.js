// This treats trips as a collection of posts
var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var Album = require('../../models/album');
var Trip = require('../../models/trip');

var apiController = require('../../controllers/apiController');
var multer = require('multer');
var mailer = require('express-mailer');
var app = require('../../app.js');
var randomstring = require("randomstring");
var jwt = require('jsonwebtoken');

var printError = apiController.printError;
var printResult = apiController.printResult;
var ensureAdmin = apiController.ensureAdmin;
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi;
var uniqueName = apiController.uniqueName;
var newtoken = apiController.newtoken;
var validateErrors = apiController.validateErrors;
var appendAuth = apiController.appendAuth;
var removeDuplicates = apiController.removeDuplicates;


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
    newTrip.save(function (err, trip) {
        if (!printError(err, req, res)) {
            req.trip = trip;
            next();
        }
    });
}

router.post('/', ensureAuthenticatedApi, validateTrip, createTrip, validatePosts, addPosts, function (req, res) {
    res.status(201).json({
        success: true,
        trip: req.trip
    });
});

function checkTrip(req, res, next) {
    Trip.findById(req.params.tripId).populate({
        path: 'albums'
    }).exec(function (err, trip) {
        if (!printError(err, req, res)) {
            if (trip == null || !trip) {
                res.status(404).json({
                    success: false,
                    errors: [{
                        "msg": "Trip not found!"
                    }]
                });
            } else {
                req.trip = trip;
                next();
            }
        }
    });
}

// Retrieves the tip and its public posts
function getTrip(req, res, next) {
    Trip.findById(req.params.tripId).populate({
        path: 'albums'
    }).populate({
        path: 'user'
    }).populate({
        path: "posts",
        match: {
            public: true
        }
    }).exec(function (err, trip) {
        if (!printError(err, req, res)) {
            if (trip == null || !trip) {
                res.status(404).json({
                    success: false,
                    errors: [{
                        "msg": "Trip not found!"
                    }]
                });
            } else {
                trip.user.password = "";
                trip.user.verificationCode = "";
                req.trip = trip;
                next();
            }
        }
    });
}

function checkTripAbs(req, res, next) {
    Trip.findOne({
        _id: req.params.tripId,
    }).exec(function (err, trip) {
        if (!printError(err, req, res)) {
            if (trip == null || !trip) {
                res.status(404).json({
                    success: false,
                    errors: [{
                        "msg": "Trip not found!"
                    }]
                });
            } else {
                req.trip = trip;
                next();
            }
        }
    });
}

function verifyPublicOrOwner(req, res, next) {
    if (req.trip.public != true && (!req.decoded || !req.decoded.user._id == req.trip.user)) {
        res.status(403).json({
            success: false,
            errors: [{
                "msg": "Private Trip."
            }]
        });
    } else {
        next();
    }
}

// view trip
router.get('/:tripId', getTrip, appendAuth, verifyPublicOrOwner, function (req, res) {
    res.status(200).json({
        trip: req.trip
    });
});

function verifyOwnership(req, res, next) {
    userId = req.decoded.user._id;
    tripUser = req.trip.user;
    console.log(userId)
    console.log(req.trip)
    if (userId != tripUser) {
        res.status(403).json({
            success: false,
            errors: [{
                "msg": "Not owner of this trip."
            }]
        });
    } else {
        next();
    }
}

function validatePostsNotEmpty(req, res, next) {
    req.checkBody('title', 'No posts provided!').notEmpty();
    validateErrors(req, res, next);
}

function validatePosts(req, res, next) {
    if (!req.body.posts) {
        return next();
    }
    posts = req.body.posts;
    if (!Array.isArray(posts)) {
        posts = [posts];
    }
    var limit = posts.length;
    Post.find({
        '_id': {
            $in: req.body.posts
        },
        'user': req.decoded.user._id
    }, function (err, posts) {
        console.log(posts);
        req.posts = posts;
        req.posts_ids = req.posts.map(function (item) {
            return item._id;
        });
        next();
    });
}

function addPosts(req, res, next) {
    if (!req.body.posts) {
        return next();
    }
    req.trip.posts = req.trip.posts.concat(req.posts_ids);
    req.trip.posts = removeDuplicates(req.trip.posts);
    req.trip.save(function (err, newTrip) {
        if (!printError(err, req, res)) {
            req.trip = newTrip;
            next();
        }
    });

}

function populateTripPosts(req, res, next) {
    if (!req.trip) {
        next();
    } else {
        Trip.findOne({
            _id: req.trip._id
        }).populate({
            path: "posts"
        }).exec((err, trip) => {
            if (!printError(err, req, res)) {
                req.trip = trip;
                next()
            }
        });
    }
}

// add posts in trip
router.post('/:tripId/posts', ensureAuthenticatedApi, checkTripAbs,
    verifyOwnership, validatePosts, addPosts, populateTripPosts,
    function (req, res) {
        res.status(200).json({
            success: true,
            trip: req.trip
        });
    });

function removePosts(req, res, next) {
    if (!req.body.posts) {
        return next();
    }
    req.trip.posts = req.trip.posts.filter(x => !req.body.posts.includes(x));
    req.trip.posts = removeDuplicates(req.trip.posts);
    req.trip.save(function (err, newTrip) {
        if (!printError(err, req, res)) {
            req.trip = newTrip;
            next();
        }
    });
}

// remove albums from trip
router.delete('/:tripId/posts', ensureAuthenticatedApi, checkTripAbs,
    verifyOwnership, validatePosts, removePosts, populateTripPosts,
    function (req, res) {
        res.status(200).json({
            success: true,
            data: req.trip
        });
    });

function editTrip(req, res, next) {
    Trip.findByIdAndUpdate({
        _id: req.trip._id
    }, req.body.trip, {
        new: true
    }, (err, updatedTrip) => {
        if (!printError(err, req, res)) {
            req.trip = updatedTrip;
            next();
        }
    });
}

router.put("/:tripId", ensureAuthenticatedApi, checkTripAbs, verifyOwnership, editTrip, populateTripPosts, function (req, res) {
    res.status(200).json({
        trip: req.trip,
        msg: "Updated trip"
    });
});

function removeTrip(req, res, next) {
    Trip.remove({
        _id: req.trip._id
    }, function (err, removeRes) {
        if (!printError(err, req, res)) {
            next();
        }
    });
}

router.delete('/:tripId', ensureAuthenticatedApi, checkTripAbs,
    verifyOwnership, removeTrip,
    function (req, res) {
        res.status(200).json({
            success: true,
            msg: "Deleted Trip"
        });
    });

module.exports = router;
var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var Album = require('../../models/album');

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

function validateAlbum(req, res, next) {
	req.checkBody('title', 'No title provided!').notEmpty();
	validateErrors(req, res, next);
}

function createAlbum(req, res, next) {
	var newAlbum = new Album({
		user: req.decoded.user._id,
		title: req.body.title,
		public: req.body.public || true,
		posts: []
	});
	newAlbum.save(function(err, album) {
		if(!printError(err, req, res)) {
			req.album = album;
			next();
		}
	});
}

router.post('/create', ensureAuthenticatedApi, validateAlbum, createAlbum, validatePosts, addPosts, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.album
	});
});

function checkAlbum(req, res, next) {
	Album.findById(req.params.albumId).populate({path: 'posts'}).exec(function(err, album) {
		if(!printError(err, req, res)) {
			if(album==null ||!album) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Album not found!"}]
				});
			} else {
				req.album = album;
				next();
			}
		}
	});
}

function checkAlbumAbs(req, res, next) {
	Album.findById(req.params.albumId).exec(function(err, album) {
		if(!printError(err, req, res)) {
			if(album==null ||!album) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Album not found!"}]
				});
			} else {
				req.album = album;
				next();
			}
		}
	});
}

function verifyPublicOrOwner(req, res, next) {
	if(req.album.public!=true || !req.decoded || !req.decoded.user._id==req.post.user) {
		res.status(403).json({
			success: false,
			errors: [{"msg":"Private album."}]
		});
	} else {
		next();
	}
}

router.get('/:albumId', checkAlbum, appendAuth, verifyPublicOrOwner, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.album
	});
});

function verifyOwnership(req, res, next) {
	userId = req.decoded.user._id;
	albumUser = req.album.user;
	if(userId!=albumUser) {
		res.status(403).json({
			success: false,
			errors: [{"msg": "Not owner of this album."}]
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
	if(!req.body.posts) {
		return next();
	}
	posts = req.body.posts;
	if(!Array.isArray(posts)) {
		posts = [posts];
	}
	var limit =  posts.length;
	var i = 0;
	posts.forEach(function(postId) {
		if(req.album.posts.indexOf(postId) >= 0) {
			res.status(400).json({
				success: false,
				errors: [{"msg":"Duplicate posts in album."}]
			});
			return;
		}
		Post.findById(postId, function(err, postRes) {
			if(req.error==true) {
				// returned error before, don't do anything
				return;
			}
			if(!err && postRes!=null) {
				// verify ownership
				if(postRes.user!=req.decoded.user._id) {
					req.error = true;
					res.status(404).json({
						success: false,
						errors: [{"msg":"One or more post don't belong to you."}]
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
					errors: [{"msg":"One or more post doesn't exist."}]
				});
			}
		});
	});
	req.posts = posts;

}

function addPosts(req, res, next) {
	if(!req.body.posts) {
		return next();
	}
	Album.findOneAndUpdate({_id: req.album._id},
		{$pushAll: {posts: req.posts}}, {new: true},
	function(err, newAlbum) {
		if(!printError(err, req, res)) {
			req.newAlbum = newAlbum;
			next();
		}
	});
} 

router.post('/add/:albumId', ensureAuthenticatedApi, checkAlbumAbs,
	verifyOwnership, validatePostsNotEmpty, validatePosts, addPosts, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.newAlbum
	});
});

function removePosts(req, res, next) {
	posts = req.body.posts;
	if(!Array.isArray(posts)) {
		posts = [posts];
	}
	Album.findOneAndUpdate({_id: req.album._id},
		{$pullAll: {posts: posts}}, {new: true},
	function(err, newAlbum) {
		if(!printError(err, req, res)) {
			req.newAlbum = newAlbum;
			next();
		}
	});
} 

router.post('/remove/:albumId', ensureAuthenticatedApi, checkAlbum,
	verifyOwnership, validatePosts, removePosts, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.newAlbum
	});
});

function removeAlbum(req, res, next) {
	Album.remove({_id: req.album._id}, function(err, removeRes) {
		if(!printError(err, req, res)) {
			next();
		}
	});
}

router.post('/delete/:albumId', ensureAuthenticatedApi, checkAlbum,
	verifyOwnership, removeAlbum, function(req, res) {
		res.status(200).json({
			success: true,
			msg: "Deleted album"
		});
});

module.exports = router;
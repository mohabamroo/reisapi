var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
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
// location in post?
function createNewPost(req, res, next) {
	var newPost = new Post({
		user: req.decoded.user._id,
		text: req.body.text || "no caption",
		public: req.body.public || true,
		dataURL: req.body.dataURL
	});
	req.newPost = newPost;
	newPost.save(function(err, postRes) {
		if(!printError(err, req, res)) {
			req.newPost = postRes;
			next();
        }
	});
}

function validateNewPost(req, res, next) {
	req.checkBody('dataURL', 'No img/vid provided!').notEmpty();
	validateErrors(req, res, next);
}

router.post('/create', ensureAuthenticatedApi, validateNewPost, createNewPost, function(req, res) {
	res.status(200).json({
		success: true,
		msg: "Uploaded post.",
		data: req.newPost
	});
});


function checkPost(req, res, next) {
	Post.findById(req.params.postId, function(err, post) {
		if(!printError(err, req, res)) {
			if(post==null ||!post) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Post not found!"}]
				});
			} else {
				req.post = post;
				next();
			}
		}
	});
}

function verifyOwnership(req, res, next) {
	userId = req.decoded.user._id;
	postUser = req.post.user;
	if(userId!=postUser) {
		res.status(403).json({
			success: false,
			errors: [{"msg": "Not owner of this post."}]
		});
	} else {
		next();
	}
}

function deletePost(req, res, next) {
	Post.remove({_id: req.post._id}, function(err, removeRes) {
		if(!printError(err, req, res)) {
			printResult(removeRes);
			next();
		}
	});
}

router.post('/delete/:postId/', ensureAuthenticatedApi, checkPost, verifyOwnership, deletePost, function(req, res) {
	res.status(200).json({
		success: true,
		msg: "Deleted post."
	});
});


function updatePost(req, res, next) {
	Post.findOneAndUpdate({_id: req.post._id}, {$set: {
		text: req.body.text || req.post.text,
		public: req.body.public || req.post.public,
		location: req.body.location || req.post.location
	}},
	{new: true}, function(err, updatedPost) {
		if(!printError(err, req, res)) {
			req.updatedPost = updatedPost;
			next();
		}
	});
}

router.post('/update/:postId/', ensureAuthenticatedApi, checkPost, verifyOwnership, updatePost, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.updatedPost,
		msg: "Updated post."
	});
});

function verifyPublicOrOwner(req, res, next) {
	if(req.post.public!=true || !req.decoded || !req.decoded.user._id==req.post.user) {
		res.status(403).json({
			success: false,
			errors: [{"msg":"Private post."}]
		});
	} else {
		next();
	}
}

router.get('/:postId', checkPost, appendAuth, verifyPublicOrOwner, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.post
	});
})
module.exports = router;
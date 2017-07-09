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
		dataURL: req.body.dataURL,
		sticker: req.body.sticker
	});
	req.newPost = newPost;
	console.log(newPost);
	newPost.save(function(err, postRes) {
		console.log(postRes);
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

function getPost(req, res, next) {
	Post.findById(req.params.postId).populate({'path':'user'}).exec(function(err, post) {
		if(!printError(err, req, res)) {
			if(post==null ||!post) {
				res.status(404).json({
					success: false,
					errors: [{"msg":"Post not found!"}]
				});
			} else {
				post.user.password = "";
				post.user.verificationCode = "";
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
	console.log(req.post.public)
	if(req.post.public!=true && (!req.decoded || !req.decoded.user._id==req.post.user)) {
		res.status(403).json({
			success: false,
			errors: [{"msg":"Private post."}]
		});
	} else {
		next();
	}
}

router.get('/:postId', getPost, appendAuth, verifyPublicOrOwner, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.post
	});
});

/*router.get('/search/:sticker', function(req, res) {
	Post.search( {query_string:{query:req.params.sticker}}, { hydrate:true }, function(err,results) {  
		console.log(err);
		res.json(results);
	});
});*/

router.get('/search/:sticker', function(req, res) {
	Post.find( {sticker: req.params.sticker}, function(err, results) {  
		if(!printError(err, req, res)) {
			res.status(200).json(results);
		}
	});
});


function getUser(req, res, next) {
	var username = req.params.username;
	User.findOne({username: username}, function(err, user) {
		if(!printError(err, req, res)) {
			if(user) {
				user.password = "";
				req.user = user;
				next();
			} else {
				res.status(404).json({
					success: false,
					errors: [{"msg":"User not found"}]
				});
			}
		}
	});
}

function getUserPosts(req, res, next) {
	var pageNumber = req.params.pageNumber;
	var nPerPage = 5;
	var skipN = pageNumber > 0 ? ((pageNumber-1)*nPerPage) : 0;
	Post.find({user: req.user._id}).skip(skipN).limit(nPerPage).exec(function(err, posts) {
		if(!printError(err, req, res)) {
			req.posts = posts;
			next();
		}
	});
}

function filterPosts(req, res, next) {
	console.log(req.user._id);
	// console.log(req.decoded.user._id);
	if(req.decoded && req.user._id == req.decoded.user._id) {
		next();
	} else {
		var publicPosts = [];
		req.posts.forEach(function(post) {
			if(post.public==true) {
				publicPosts.push(post);
			}
		});
		req.posts = publicPosts;
		next();
	}
}

router.get('/list/:username/:pageNumber', getUser, appendAuth, getUserPosts, filterPosts, function(req, res) {
	res.status(200).json({
		success: true,
		data: {
			posts: req.posts,
			user: req.user
		}
	});

});

function getPosts(req, res, next) {
	var pageNumber = req.params.pageNumber;
	var nPerPage = 10;
	var skipN = pageNumber > 0 ? ((pageNumber-1)*nPerPage) : 0;
	Post.find().skip(skipN).limit(nPerPage).sort({created: 'desc'})
	.populate({path:'user', select: {'password': 0, 'verificationCode': 0}})
	.exec(function(err, posts) {
		if(!printError(err, req, res)) {
			req.posts = posts;
			next();
		}
	});
}

router.get('/timeline/:pageNumber', ensureAuthenticatedApi, getPosts, function(req, res) {
	res.status(200).json({
		success: true,
		data: req.posts
	});
});


module.exports = router;
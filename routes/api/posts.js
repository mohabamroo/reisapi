var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var apiController = require('../../controllers/apiController');
var multer = require('multer');
var mailer = require('express-mailer');
var app = require('../../app.js');
var randomstring = require("randomstring");
var jwt = require('jsonwebtoken');

var deepPopulate = require('mongoose-deep-populate')(global.mongoose);

var printError = apiController.printError;
var printResult = apiController.printResult;
var ensureAdmin = apiController.ensureAdmin;
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi;
var removeDuplicates = apiController.removeDuplicates;
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
		stickers: req.body.stickers,
		location: {
			lat: req.body.lat,
			lng: req.body.lng
		}
	});
	req.newPost = newPost;
	console.log(newPost)
	newPost.save(function (err, postRes) {
		console.log("fglgnlfjn")
		if (!printError(err, req, res)) {
			console.log("flgjn")
			req.newPost = postRes;
			next();
		}
	});
}

function validateNewPost(req, res, next) {
	req.checkBody('dataURL', 'No img/vid provided!').notEmpty();
	validateErrors(req, res, next);
}

router.post('/', ensureAuthenticatedApi, validateNewPost, createNewPost, function (req, res) {
	res.status(200).json({
		success: true,
		msg: "Uploaded post.",
		data: req.newPost
	});
});


function checkPost(req, res, next) {
	Post.findById(req.params.postId, function (err, post) {
		if (!printError(err, req, res)) {
			if (post == null || !post) {
				res.status(404).json({
					success: false,
					errors: [{
						"msg": "Post not found!"
					}]
				});
			} else {
				req.post = post;
				next();
			}
		}
	});
}

function getPost(req, res, next) {
	Post.findById(req.params.postId).populate({
		'path': 'user'
	}).populate({
		'path': 'stickers'
	}).exec(function (err, post) {
		if (!printError(err, req, res)) {
			if (post == null || !post) {
				res.status(404).json({
					success: false,
					errors: [{
						"msg": "Post not found!"
					}]
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
	if (userId != postUser) {
		res.status(403).json({
			success: false,
			errors: [{
				"msg": "Not owner of this post."
			}]
		});
	} else {
		next();
	}
}

function deletePost(req, res, next) {
	Post.remove({
		_id: req.post._id
	}, function (err, removeRes) {
		if (!printError(err, req, res)) {
			printResult(removeRes);
			next();
		}
	});
}

router.delete('/:postId/', ensureAuthenticatedApi, checkPost, verifyOwnership, deletePost, function (req, res) {
	res.status(200).json({
		success: true,
		msg: "Deleted post."
	});
});


function updatePost(req, res, next) {
	Post.findOneAndUpdate({
		_id: req.post._id
	}, {
		$set: {
			text: req.body.text || req.post.text,
			public: req.body.public || req.post.public,
			location: req.body.location || req.post.location
		}
	}, {
		new: true
	}, function (err, updatedPost) {
		if (!printError(err, req, res)) {
			req.updatedPost = updatedPost;
			next();
		}
	});
}

router.put('/:postId/', ensureAuthenticatedApi, checkPost, verifyOwnership, updatePost, function (req, res) {
	res.status(200).json({
		success: true,
		data: req.updatedPost,
		msg: "Updated post."
	});
});

function verifyPublicOrOwner(req, res, next) {
	if (req.post.public != true && (!req.decoded || !req.decoded.user._id == req.post.user)) {
		res.status(403).json({
			success: false,
			errors: [{
				"msg": "Private post."
			}]
		});
	} else {
		next();
	}
}

router.get('/:postId', getPost, appendAuth, verifyPublicOrOwner, function (req, res) {
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

function updateStickers(req, res, next) {
	req.post.stickers = req.post.stickers.concat(req.body.add);
	req.post.stickers = req.post.stickers.filter(x => !req.body.remove.includes(x));
	req.post.stickers = removeDuplicates(req.post.stickers);
	req.post.save(function (err, updatedPost) {
		req.post = updatedPost;
		if (!printError(err, req, res)) {
			next();
		}
	});
}
router.post('/:postId/stickers/', ensureAuthenticatedApi, checkPost, verifyOwnership, updateStickers, function (req, res) {
	res.status(200).json({
		msg: "Stickers updated!",
		post: req.post
	});
});

router.get('/sticker/:sticker', function (req, res) {
	Post.find({
			stickers: req.params.sticker
		}).populate({
			path: "user",
			select: {
				'password': 0,
				'verificationCode': 0
			}
		}).populate({
			path: 'stickers',
			select: {
				'name': 1
			}
		})
		.exec(function (err, results) {
			if (!printError(err, req, res)) {
				res.status(200).json({posts: results});
			}
		});
});


function getUser(req, res, next) {
	var username = req.params.username;
	User.findOne({
		username: username
	}, function (err, user) {
		if (!printError(err, req, res)) {
			if (user) {
				user.password = "";
				req.user = user;
				next();
			} else {
				res.status(404).json({
					success: false,
					errors: [{
						"msg": "User not found"
					}]
				});
			}
		}
	});
}

function getUserPosts(req, res, next) {
	var pageNumber = req.params.pageNumber;
	var nPerPage = 5;
	var skipN = pageNumber > 0 ? ((pageNumber - 1) * nPerPage) : 0;
	Post.find({
			user: req.user._id
		})
		.skip(skipN).limit(nPerPage)
		.populate({
			path: 'stickers',
			select: {
				'name': 1
			}
		})
		.populate({
			path: 'stickers',
			select: {
				'name': 1
			}
		})
		.exec(function (err, posts) {
			if (!printError(err, req, res)) {
				req.posts = posts;
				next();
			}
		});
}

function filterPosts(req, res, next) {
	if (req.decoded && req.user._id == req.decoded.user._id) {
		next();
	} else {
		var publicPosts = [];
		req.posts.forEach(function (post) {
			if (post.public == true) {
				publicPosts.push(post);
			}
		});
		req.posts = publicPosts;
		next();
	}
}

router.get('/list/:username/:pageNumber', getUser, appendAuth, getUserPosts, filterPosts, function (req, res) {
	res.status(200).json({
		success: true,
		data: {
			posts: req.posts,
			user: req.user
		}
	});

});

// TODO: Add find criteria
function getPosts(req, res, next) {
	var pageNumber = req.params.pageNumber;
	var nPerPage = 10;
	var skipN = pageNumber > 0 ? ((pageNumber - 1) * nPerPage) : 0;
	Post.find().skip(skipN).limit(nPerPage).sort({
			created: 'desc'
		})
		.populate({
			path: 'stickers',
			select: {
				'name': 1
			}
		})
		.populate({
			path: 'user',
			select: {
				'password': 0,
				'verificationCode': 0
			}
		})
		.exec(function (err, posts) {
			if (!printError(err, req, res)) {
				req.posts = posts;
				next();
			}
		});
}

router.get('/timeline/:pageNumber', ensureAuthenticatedApi, getPosts, function (req, res) {
	res.status(200).json({
		success: true,
		posts: req.posts
	});
});


module.exports = router;
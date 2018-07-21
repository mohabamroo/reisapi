var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var Sticker = require('../../models/sticker');
var apiController = require('../../controllers/apiController');
var ensureAuthenticatedApi = apiController.ensureAuthenticatedApi;
var validateErrors = apiController.validateErrors;
var printError = apiController.printError;

function getUserStickers(req, res, next) {
    User.findById(
        req.decoded.user._id,
        function (err, user) {
            if (!printError(err, req, res)) {
                req.decoded.user = user;
                next();
            }
        });
}

function fetchTimelinePosts(req, res, next) {
    Post.find({
        stickers: {
            "$in": req.decoded.user.stickers
        },
        user: {
            '"$ne': req.decoded.user._id
        }
    }, null, {
        sort: {
            created: -1
        }
    }).populate({
        path: 'user',
        select: {
            'verificationCode': 0,
            'password': 0
        },
    }).populate({
        path: 'stickers'
    }).exec(function (err, posts) {
        if (!printError(err, req, res)) {
            req.posts = posts;
            next();
        }
    });
}

router.get('/', ensureAuthenticatedApi, getUserStickers, fetchTimelinePosts, function (req, res) {
    res.status(200).json({
        posts: req.posts
    });
});


module.exports = router;
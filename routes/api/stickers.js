var express = require('express');
var router = express.Router();
var User = require('../../models/user');
var Post = require('../../models/post');
var Sticker = require('../../models/sticker');
var apiController = require('../../controllers/apiController');
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

function createNewSticker(req, res, next) {
	var newSticker = new Sticker({
		name: req.body.name
    });
	newSticker.save(function(err, stickerRes) {
		if(!printError(err, req, res)) {
			req.newSticker = stickerRes;
			next();
        }
	});
}

function validateNewSticker(req, res, next) {
	req.checkBody('name', 'No name provided').notEmpty();
	validateErrors(req, res, next);
}

router.post('/create', ensureAuthenticatedApi, ensureAdmin, validateNewSticker, createNewSticker, function(req, res) {
	res.status(200).json({
		msg: "Created new sticker.",
		data: req.newSticker
	});
});


module.exports = router;
var mongoose = require('mongoose');

var postSchema = mongoose.Schema({
	user: {
		type: String,
		index: true, 
		required: true,
		ref: 'User'
	},
	text: {
		type: String
	},
	public: {type: Boolean, default: true},
	location: {
		type: String
	},
	dataURL: String,
});

var Post = module.exports = mongoose.model('Post', postSchema);

module.exports.createPost = function(newPost, callback) {
	newPost.save(callback);
}


var mongoose = require('mongoose');

var albumSchema = mongoose.Schema({
	user: {
		type: String,
		index: true, 
		required: true,
		ref: 'User'
	},
	title: {
		type: String
	},
	cover: String,
	description: String,
	public: {type: Boolean, default: true},
	posts: [ {
		type: String,
		ref: 'Post'
	}],
	location: {
		lat: String,
		lng: String
	},
	
});

var Album = module.exports = mongoose.model('Album', albumSchema);

module.exports.createAlbum = function(newAlbum, callback) {
	newAlbum.save(callback);
}


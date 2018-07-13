var mongoose = require('mongoose');

var tripSchema = mongoose.Schema({
	user: {
		type: String,
		index: true, 
		required: true,
		ref: 'User'
	},
	title: {
		type: String
	},
	posts: [ {
		type: String,
		ref: 'Post'
	}],
	public: {type: Boolean, default: true},
	albums: [ {
		type: String,
		ref: 'Album'
	}]
});

var Trip = module.exports = mongoose.model('Trip', tripSchema);

module.exports.createTrip = function(newTrip, callback) {
	newTrip.save(callback);
}


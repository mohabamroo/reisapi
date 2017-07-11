// var mongoosastic=require("mongoosastic");

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
	sticker: {type: String, index:true},
	created: { type: Date, default: Date.now },
	location: {
		lat: String,
		lng: String
	},
	// sticker: {type: String, es_indexed:true}

});


var Post = module.exports = mongoose.model('Post', postSchema);

// for elastic search
/*var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: 'https://elastic:yeUKaihJooFGQR80Br8bikd0@38df4fa61dc3d0ddc8307c1f1f8be63a.us-east-1.aws.found.io:9243',
  log: 'trace'
});
yeUKaihJooFGQR80Br8bikd0
postSchema.plugin(mongoosastic, {esClient: client});  
*//*Post.createMapping(function(err, mapping){  
  if(err){
    console.log('error creating mapping (you can safely ignore this)');
    console.log(err);
  }else{
    console.log('mapping created!');
    console.log(mapping);
  }
});*/

module.exports.createPost = function(newPost, callback) {
	newPost.save(callback);
}


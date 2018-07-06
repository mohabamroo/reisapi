var mongoose = require('mongoose');

var stickerSchema = mongoose.Schema({
    name: {
        type: String,
        unique: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

var Sticker = module.exports = mongoose.model('Sticker', stickerSchema);
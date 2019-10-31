var mongoose = require('mongoose');

var RecordSchema= mongoose.Schema({
	name:{
		type: 'String',
		required: true,
	},
	date: {
		type: Date,
		required: true
	},
	stopDurations: [{
		from: {
			type: Date,
			required: true
		},
		to: {
			type: Date,
			required: true
		}
	}]
});

module.exports = mongoose.model('Record', RecordSchema);
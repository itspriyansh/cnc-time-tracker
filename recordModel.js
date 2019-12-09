var mongoose = require('mongoose');

// Schema of collection the records stop-durations of all machines everyday

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
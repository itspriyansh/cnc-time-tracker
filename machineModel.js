var mongoose = require('mongoose');

// Schema of collection that tracks status and stop-durations of machines on current day

const MachineSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
		unique: true
    },
    functioning: {
        type: Boolean,
        default: false
    },
    startTime: {
        type: Date,
        default: null
    },
    stopTime: {
        type: Date,
        default: null
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
module.exports = mongoose.model('Machine', MachineSchema);
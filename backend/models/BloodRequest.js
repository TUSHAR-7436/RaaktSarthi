const mongoose = require('mongoose');

const BloodRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  units: {
    type: Number,
    required: true,
    min: 1
  },
  urgency: {
    type: String,
    enum: ['critical', 'urgent', 'normal'],
    default: 'normal'
  },
  hospital: {
    name: String,
    address: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number]
      }
    }
  },
  contactNumber: {
    type: String,
    required: true
  },
  requiredBy: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default: 7 days from now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String
  },
  bloodBank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodBank'
  },
  bloodBankResponse: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BloodBank'
    },
    responseNote: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BloodRequest', BloodRequestSchema);

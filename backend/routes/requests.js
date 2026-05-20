const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const BloodRequest = require('../models/BloodRequest');

// @route   GET /api/requests
// @desc    Get all blood requests
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, bloodGroup } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (bloodGroup) query.bloodGroup = bloodGroup;

    const requests = await BloodRequest.find(query)
      .populate('requestedBy', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/requests/my-requests
// @desc    Get user's blood requests
// @access  Private
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await BloodRequest.find({ requestedBy: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/requests
// @desc    Create a new blood request
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { patientName, bloodGroup, units, urgency, hospital, contactNumber, requiredBy, description } = req.body;

    // Validation
    if (!patientName || !bloodGroup || !units || !contactNumber) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['patientName', 'bloodGroup', 'units', 'contactNumber'],
        received: { patientName: !!patientName, bloodGroup: !!bloodGroup, units: !!units, contactNumber: !!contactNumber }
      });
    }

    // Set default requiredBy if not provided (7 days from now)
    const requestDate = requiredBy ? new Date(requiredBy) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const bloodRequest = new BloodRequest({
      requestedBy: req.user.userId,
      patientName,
      bloodGroup,
      units: parseInt(units),
      urgency: urgency || 'normal',
      hospital: hospital || { name: '', address: '' },
      contactNumber,
      requiredBy: requestDate,
      description: description || ''
    });

    await bloodRequest.save();
    
    // Populate the requester info
    await bloodRequest.populate('requestedBy', 'name email phone');
    
    res.status(201).json({ 
      success: true,
      message: 'Blood request created successfully', 
      request: bloodRequest 
    });
  } catch (error) {
    console.error('Error creating blood request:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create blood request', 
      error: error.message 
    });
  }
});

// @route   PUT /api/requests/:id
// @desc    Update blood request status
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = status;
    await request.save();

    res.json({ message: 'Request updated successfully', request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/requests/:id/status
// @desc    Update blood request status (for users to cancel OR blood banks to approve/decline)
// @access  Private (User or Blood Bank)
router.patch('/:id/status', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { status } = req.body;
    
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // If blood bank, allow approve/decline
    if (decoded.type === 'bloodbank') {
      if (!['approved', 'declined'].includes(status)) {
        return res.status(400).json({ message: 'Blood banks can only approve or decline requests' });
      }
      
      request.status = status;
      await request.save();
      
      return res.json({ message: `Request ${status} successfully`, request });
    }
    
    // If user, verify ownership and allow cancellation
    if (request.requestedBy.toString() !== decoded.userId) {
      return res.status(403).json({ message: 'Not authorized to modify this request' });
    }

    if (status === 'cancelled' && request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }

    request.status = status;
    await request.save();
    
    res.json({ message: 'Request status updated successfully', request });
  } catch (error) {
    console.error('Request status update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

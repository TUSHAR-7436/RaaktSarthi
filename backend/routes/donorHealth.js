const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DonorHealth = require('../models/DonorHealth');
const BloodBank = require('../models/BloodBank');
const auth = require('../middleware/auth');

// Middleware to protect blood bank routes
const protectBloodBank = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'bloodbank') {
        return res.status(401).json({ message: 'Not authorized as blood bank' });
      }
      
      req.bloodBank = await BloodBank.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// @route   POST /api/donor-health
// @desc    Submit a donor health form
// @access  Private (User)
router.post('/', auth, async (req, res) => {
  try {
    const {
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      weight,
      phone,
      email,
      address,
      city,
      medicalConditions,
      recentActivities,
      currentHealth,
      lifestyle,
      donationHistory,
      consent
    } = req.body;

    // Validate consent
    if (!consent.informationAccurate || !consent.consentToDonate || !consent.understandsProcess) {
      return res.status(400).json({ message: 'All consent fields must be accepted' });
    }

    // Check for existing pending form
    const existingForm = await DonorHealth.findOne({
      donor: req.user._id,
      status: 'pending'
    });

    if (existingForm) {
      return res.status(400).json({ 
        message: 'You already have a pending health form. Please wait for review.' 
      });
    }

    // Create new health form
    const healthForm = new DonorHealth({
      donor: req.user._id,
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      weight,
      phone,
      email,
      address,
      city,
      medicalConditions,
      recentActivities,
      currentHealth,
      lifestyle,
      donationHistory,
      consent
    });

    await healthForm.save();

    res.status(201).json({
      message: 'Health form submitted successfully',
      healthForm: {
        id: healthForm._id,
        eligibility: healthForm.eligibility,
        status: healthForm.status
      }
    });
  } catch (error) {
    console.error('Error submitting health form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/donor-health/my-forms
// @desc    Get donor's health forms
// @access  Private (User)
router.get('/my-forms', auth, async (req, res) => {
  try {
    const forms = await DonorHealth.find({ donor: req.user._id })
      .sort({ submittedAt: -1 });
    
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/donor-health/latest
// @desc    Get donor's latest health form
// @access  Private (User)
router.get('/latest', auth, async (req, res) => {
  try {
    const form = await DonorHealth.findOne({ donor: req.user._id })
      .sort({ submittedAt: -1 });
    
    if (!form) {
      return res.status(404).json({ message: 'No health form found' });
    }
    
    res.json(form);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/donor-health/eligibility
// @desc    Check donor eligibility
// @access  Private (User)
router.get('/eligibility', auth, async (req, res) => {
  try {
    const form = await DonorHealth.findOne({ donor: req.user._id })
      .sort({ submittedAt: -1 });
    
    if (!form) {
      return res.json({ 
        hasForm: false,
        message: 'Please complete the health form first' 
      });
    }
    
    res.json({
      hasForm: true,
      isEligible: form.eligibility.isEligible,
      reasons: form.eligibility.reasonsForIneligibility,
      status: form.status,
      submittedAt: form.submittedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/donor-health
// @desc    Get all health forms (for blood bank review)
// @access  Private (Blood Bank)
router.get('/', protectBloodBank, async (req, res) => {
  try {
    const { status, isEligible } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (isEligible !== undefined) {
      query['eligibility.isEligible'] = isEligible === 'true';
    }
    
    const forms = await DonorHealth.find(query)
      .populate('donor', 'name email phone')
      .sort({ submittedAt: -1 });
    
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/donor-health/:id
// @desc    Get health form by ID
// @access  Private (Blood Bank)
router.get('/:id', protectBloodBank, async (req, res) => {
  try {
    const form = await DonorHealth.findById(req.params.id)
      .populate('donor', 'name email phone');
    
    if (!form) {
      return res.status(404).json({ message: 'Health form not found' });
    }
    
    res.json(form);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/donor-health/:id/review
// @desc    Review a health form
// @access  Private (Blood Bank)
router.put('/:id/review', protectBloodBank, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    
    const form = await DonorHealth.findById(req.params.id);
    
    if (!form) {
      return res.status(404).json({ message: 'Health form not found' });
    }
    
    form.status = status;
    form.reviewNotes = reviewNotes;
    form.reviewedBy = req.bloodBank._id;
    form.reviewedAt = Date.now();
    
    await form.save();
    
    res.json({
      message: 'Health form reviewed successfully',
      form
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/donor-health/:id
// @desc    Update a health form (by donor)
// @access  Private (User)
router.put('/:id', auth, async (req, res) => {
  try {
    const form = await DonorHealth.findById(req.params.id);
    
    if (!form) {
      return res.status(404).json({ message: 'Health form not found' });
    }
    
    // Check if the form belongs to this user
    if (form.donor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Only allow updates if status is pending or requires_review
    if (!['pending', 'requires_review'].includes(form.status)) {
      return res.status(400).json({ 
        message: 'Cannot update a form that has been approved or rejected' 
      });
    }
    
    // Update fields
    const updateFields = [
      'fullName', 'dateOfBirth', 'gender', 'bloodGroup', 'weight',
      'phone', 'email', 'address', 'city',
      'medicalConditions', 'recentActivities', 'currentHealth',
      'lifestyle', 'donationHistory', 'consent'
    ];
    
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        form[field] = req.body[field];
      }
    });
    
    form.status = 'pending'; // Reset to pending after update
    
    await form.save();
    
    res.json({
      message: 'Health form updated successfully',
      form
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

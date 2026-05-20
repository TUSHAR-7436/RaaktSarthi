const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Set default activeMode if not set
    if (!user.activeMode) {
      user.activeMode = 'patient';
      await user.save();
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, bloodGroup, isDonor, address, isAvailable, location } = req.body;
    
    const updateFields = {};
    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;
    if (bloodGroup) updateFields.bloodGroup = bloodGroup;
    if (isDonor !== undefined) updateFields.isDonor = isDonor;
    if (address) updateFields.address = address;
    if (isAvailable !== undefined) updateFields.isAvailable = isAvailable;
    if (location) updateFields.location = location;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateFields },
      { new: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/donor-info
// @desc    Update donor health information
// @access  Private
router.put('/donor-info', auth, async (req, res) => {
  try {
    const { location, ...donorInfo } = req.body;
    
    const updateFields = {
      donorInfo,
      isDonor: true
    };
    
    // Add location if provided
    if (location) {
      updateFields.location = location;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateFields },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Donor information saved successfully', user });
  } catch (error) {
    console.error('Error saving donor info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/donors
// @desc    Get available donors by blood group
// @access  Private
router.get('/donors', auth, async (req, res) => {
  try {
    const { bloodGroup, latitude, longitude, maxDistance } = req.query;
    
    let query = { isDonor: true, isAvailable: true };
    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    let donors;
    if (latitude && longitude) {
      // Geospatial query for nearby donors
      donors = await User.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: maxDistance ? parseInt(maxDistance) : 10000 // 10km default
          }
        }
      }).select('-password');
    } else {
      donors = await User.find(query).select('-password');
    }

    res.json(donors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/users/toggle-mode
// @desc    Toggle between donor and patient mode
// @access  Private
router.put('/toggle-mode', auth, async (req, res) => {
  try {
    const { mode } = req.body;
    
    console.log('Toggle mode request received:', { userId: req.user.userId, mode, body: req.body });
    
    if (!mode) {
      return res.status(400).json({ message: 'Mode parameter is required' });
    }
    
    if (!['donor', 'patient'].includes(mode)) {
      return res.status(400).json({ message: 'Invalid mode. Must be donor or patient' });
    }

    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Set default activeMode if not set
    if (!user.activeMode) {
      user.activeMode = 'patient';
    }

    // If switching to donor mode, ensure they have isDonor set
    if (mode === 'donor' && !user.isDonor) {
      return res.status(400).json({ 
        message: 'Please complete donor registration first',
        requiresRegistration: true
      });
    }

    // Update mode
    user.activeMode = mode;
    await user.save();

    res.json({ 
      success: true,
      message: `Switched to ${mode} mode successfully`, 
      user,
      activeMode: user.activeMode
    });
  } catch (error) {
    console.error('Error toggling mode:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while switching mode', 
      error: error.message 
    });
  }
});

// @route   GET /api/users/dashboard/stats
// @desc    Get dashboard statistics for charts
// @access  Private
router.get('/dashboard/stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const BloodRequest = require('../models/BloodRequest');
    const Event = require('../models/Event');
    const User = require('../models/User');

    // Get user's requests statistics
    const myRequestsStats = await BloodRequest.aggregate([
      { $match: { requestedBy: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get blood group distribution of active requests
    const bloodGroupStats = await BloodRequest.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$bloodGroup',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get urgency distribution
    const urgencyStats = await BloodRequest.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$urgency',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get monthly requests trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await BloodRequest.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get total donors and patients
    const donorCount = await User.countDocuments({ isDonor: true, isAvailable: true });
    const totalUsers = await User.countDocuments({});

    // Get upcoming events count
    const upcomingEvents = await Event.countDocuments({
      date: { $gte: new Date() },
      isActive: true
    });

    // Get user's registered events count
    const registeredEventsCount = await Event.countDocuments({
      registeredDonors: userId,
      date: { $gte: new Date() }
    });

    res.json({
      success: true,
      stats: {
        myRequests: myRequestsStats,
        bloodGroups: bloodGroupStats,
        urgency: urgencyStats,
        monthlyTrend,
        overview: {
          totalDonors: donorCount,
          totalUsers,
          upcomingEvents,
          registeredEvents: registeredEventsCount
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Event = require('../models/Event');

// @route   GET /api/events
// @desc    Get all upcoming events (public and donors-only)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance } = req.query;

    let events;
    if (latitude && longitude) {
      events = await Event.find({
        isActive: true,
        date: { $gte: new Date() },
        visibility: { $in: ['public', 'donors-only'] },
        'location.coordinates.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: maxDistance ? parseInt(maxDistance) : 50000
          }
        }
      })
      .populate('organizedBy', 'name email phone')
      .sort({ date: 1 });
    } else {
      events = await Event.find({
        isActive: true,
        date: { $gte: new Date() },
        visibility: { $in: ['public', 'donors-only'] }
      })
      .populate('organizedBy', 'name email phone')
      .sort({ date: 1 });
    }

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/events/:id/register
// @desc    Register for an event
// @access  Private
router.post('/:id/register', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.registeredDonors.includes(req.user.userId)) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    event.registeredDonors.push(req.user.userId);
    await event.save();

    res.json({ message: 'Registered successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

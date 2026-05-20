const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const BloodBank = require('../models/BloodBank');
const Inventory = require('../models/Inventory');

// Generate JWT Token for Blood Bank
const generateToken = (id) => {
  return jwt.sign({ bloodBankId: id, type: 'bloodbank' }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

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
      
      req.bloodBank = await BloodBank.findById(decoded.bloodBankId).select('-password');
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// @route   POST /api/blood-banks/register
// @desc    Register a new blood bank
// @access  Public
router.post('/register', async (req, res) => {
  try {
    console.log('Blood bank registration attempt:', { email: req.body.email, name: req.body.name });
    
    const {
      name,
      email,
      password,
      phone,
      licenseNumber,
      registrationNumber,
      establishedYear,
      address,
      city,
      state,
      pincode,
      operatingHours,
      services,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail,
      location,
      logo
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !licenseNumber) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, email, password, phone, and license number' 
      });
    }

    // Check if blood bank already exists
    const existingBloodBank = await BloodBank.findOne({ 
      $or: [{ email }, { licenseNumber }] 
    });
    
    if (existingBloodBank) {
      console.log('Blood bank already exists:', { email, licenseNumber });
      return res.status(400).json({ 
        message: 'Blood bank with this email or license number already exists' 
      });
    }

    // Initialize inventory with all blood types
    const initialInventory = [
      { bloodGroup: 'A+', units: 0 },
      { bloodGroup: 'A-', units: 0 },
      { bloodGroup: 'B+', units: 0 },
      { bloodGroup: 'B-', units: 0 },
      { bloodGroup: 'AB+', units: 0 },
      { bloodGroup: 'AB-', units: 0 },
      { bloodGroup: 'O+', units: 0 },
      { bloodGroup: 'O-', units: 0 }
    ];

    // Create blood bank
    const bloodBank = new BloodBank({
      name,
      email,
      password,
      phone,
      licenseNumber,
      registrationNumber,
      establishedYear,
      address: {
        street: address,
        city,
        state,
        pincode
      },
      operatingHours: operatingHours || { open: '09:00', close: '18:00', days: [] },
      services: services || [],
      contactPerson: {
        name: contactPersonName,
        phone: contactPersonPhone,
        email: contactPersonEmail
      },
      inventory: initialInventory,
      location: location || undefined,
      logo: logo || '',
      imageUrl: logo || ''
    });

    await bloodBank.save();

    console.log('Blood bank registered successfully:', bloodBank._id);
    
    res.status(201).json({
      message: 'Blood bank registered successfully',
      bloodBank: {
        id: bloodBank._id,
        name: bloodBank.name,
        email: bloodBank.email
      }
    });
  } catch (error) {
    console.error('Blood bank registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// @route   POST /api/blood-banks/login
// @desc    Authenticate blood bank & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for blood bank
    const bloodBank = await BloodBank.findOne({ email });
    if (!bloodBank) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bloodBank.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(bloodBank._id);

    res.json({
      token,
      bloodBank: {
        id: bloodBank._id,
        name: bloodBank.name,
        email: bloodBank.email,
        phone: bloodBank.phone,
        licenseNumber: bloodBank.licenseNumber,
        address: bloodBank.address,
        operatingHours: bloodBank.operatingHours,
        services: bloodBank.services,
        isVerified: bloodBank.isVerified,
        inventory: bloodBank.inventory || []
      }
    });
  } catch (error) {
    console.error('Blood bank login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/blood-banks/profile
// @desc    Get blood bank profile
// @access  Private (Blood Bank)
router.get('/profile', protectBloodBank, async (req, res) => {
  try {
    res.json(req.bloodBank);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/blood-banks/profile
// @desc    Update blood bank profile
// @access  Private (Blood Bank)
router.put('/profile', protectBloodBank, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.bloodBank._id);
    
    if (bloodBank) {
      bloodBank.name = req.body.name || bloodBank.name;
      bloodBank.phone = req.body.phone || bloodBank.phone;
      bloodBank.address = req.body.address || bloodBank.address;
      bloodBank.operatingHours = req.body.operatingHours || bloodBank.operatingHours;
      bloodBank.services = req.body.services || bloodBank.services;
      bloodBank.contactPerson = req.body.contactPerson || bloodBank.contactPerson;

      const updatedBloodBank = await bloodBank.save();
      res.json(updatedBloodBank);
    } else {
      res.status(404).json({ message: 'Blood bank not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/blood-banks/inventory
// @desc    Get blood bank inventory
// @access  Private (Blood Bank)
router.get('/inventory', protectBloodBank, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.bloodBank._id);
    res.json(bloodBank.inventory);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/blood-banks/inventory
// @desc    Update blood bank inventory
// @access  Private (Blood Bank)
router.put('/inventory', protectBloodBank, async (req, res) => {
  try {
    const { bloodGroup, units, operation } = req.body;
    
    const bloodBank = await BloodBank.findById(req.bloodBank._id);
    
    const inventoryItem = bloodBank.inventory.find(item => item.bloodGroup === bloodGroup);
    
    if (inventoryItem) {
      if (operation === 'add') {
        inventoryItem.units += units;
      } else if (operation === 'subtract') {
        inventoryItem.units = Math.max(0, inventoryItem.units - units);
      } else {
        inventoryItem.units = units;
      }
      inventoryItem.lastUpdated = Date.now();
      
      await bloodBank.save();
      res.json(bloodBank.inventory);
    } else {
      res.status(404).json({ message: 'Blood group not found in inventory' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/blood-banks
// @desc    Get all blood banks or nearby ones
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance, bloodGroup } = req.query;

    let bloodBanks;
    if (latitude && longitude) {
      // Geospatial query for nearby blood banks
      const query = {
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: maxDistance ? parseInt(maxDistance) : 50000 // 50km default
          }
        }
      };

      bloodBanks = await BloodBank.find(query);
    } else {
      bloodBanks = await BloodBank.find({ isActive: true });
    }

    // Fetch inventory for each blood bank from Inventory collection
    const bloodBanksWithInventory = await Promise.all(
      bloodBanks.map(async (bank) => {
        const bankObj = bank.toObject();
        const inventory = await Inventory.findOne({ bloodBank: bank._id });
        bankObj.inventory = inventory?.items || [];
        return bankObj;
      })
    );

    // Filter by blood group availability if specified
    let filteredBanks = bloodBanksWithInventory;
    if (bloodGroup) {
      filteredBanks = bloodBanksWithInventory.filter(bank => 
        bank.inventory.some(item => item.bloodGroup === bloodGroup && item.units > 0)
      );
    }

    res.json(filteredBanks);
  } catch (error) {
    console.error('Error fetching blood banks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbanks/:id
// @desc    Get blood bank by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.id);
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }
    
    // Fetch inventory from Inventory collection
    const bankObj = bloodBank.toObject();
    const inventory = await Inventory.findOne({ bloodBank: bloodBank._id });
    bankObj.inventory = inventory?.items || [];
    
    res.json(bankObj);
  } catch (error) {
    console.error('Error fetching blood bank:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/bloodbanks
// @desc    Create a new blood bank (Admin only)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, email, phone, address, location, inventory, operatingHours } = req.body;

    const bloodBank = new BloodBank({
      name,
      email,
      phone,
      address,
      location,
      inventory: inventory || [],
      operatingHours
    });

    await bloodBank.save();
    res.status(201).json({ message: 'Blood bank created successfully', bloodBank });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/bloodbanks/:id/inventory
// @desc    Update blood bank inventory
// @access  Private
router.put('/:id/inventory', auth, async (req, res) => {
  try {
    const { bloodGroup, units } = req.body;

    const bloodBank = await BloodBank.findById(req.params.id);
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    // Find and update or add inventory item
    const inventoryIndex = bloodBank.inventory.findIndex(
      item => item.bloodGroup === bloodGroup
    );

    if (inventoryIndex > -1) {
      bloodBank.inventory[inventoryIndex].units = units;
      bloodBank.inventory[inventoryIndex].lastUpdated = Date.now();
    } else {
      bloodBank.inventory.push({ bloodGroup, units, lastUpdated: Date.now() });
    }

    await bloodBank.save();
    res.json({ message: 'Inventory updated successfully', bloodBank });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

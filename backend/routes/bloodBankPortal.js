const express = require('express');
const router = express.Router();
const BloodRequest = require('../models/BloodRequest');
const BloodBank = require('../models/BloodBank');
const BloodCamp = require('../models/BloodCamp');
const Inventory = require('../models/Inventory');
const Event = require('../models/Event');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');

// Middleware to verify blood bank authentication
const bloodBankAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'bloodbank') {
      return res.status(403).json({ message: 'Access denied. Blood banks only.' });
    }

    req.bloodBank = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

// ==================== BLOOD REQUEST MANAGEMENT ====================

// @route   GET /api/bloodbank/requests
// @desc    Get all blood requests for blood bank (real-time, pending only)
// @access  Private (Blood Bank)
router.get('/requests', bloodBankAuth, async (req, res) => {
  try {
    const { status, bloodGroup, urgency, limit = 50 } = req.query;
    
    let query = {};
    
    // Show only pending requests by default for real-time view
    if (status) {
      if (status === 'approved' || status === 'rejected') {
        // For approved/rejected, filter by blood bank that responded
        query.bloodBank = req.bloodBank.bloodBankId;
        query.status = status;
      } else {
        query['bloodBankResponse.status'] = status;
      }
    } else {
      query['bloodBankResponse.status'] = { $in: ['pending', null] };
      query.status = 'pending';
    }
    
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (urgency) query.urgency = urgency;

    const requests = await BloodRequest.find(query)
      .populate('requestedBy', 'name email phone bloodGroup')
      .sort({ urgency: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/requests/approved
// @desc    Get approved blood requests by this blood bank
// @access  Private (Blood Bank)
router.get('/requests/approved', bloodBankAuth, async (req, res) => {
  try {
    const bloodBankId = req.bloodBank.bloodBankId;
    
    // Find requests where this blood bank approved
    const approvedRequests = await BloodRequest.find({
      bloodBank: bloodBankId,
      status: 'approved'
    })
      .populate('requestedBy', 'name email phone bloodGroup')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: approvedRequests.length,
      requests: approvedRequests
    });
  } catch (error) {
    console.error('Error fetching approved requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/requests/:id
// @desc    Get single blood request details
// @access  Private (Blood Bank)
router.get('/requests/:id', bloodBankAuth, async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('requestedBy', 'name email phone bloodGroup address')
      .populate('bloodBankResponse.respondedBy', 'name');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/bloodbank/requests/:id/approve
// @desc    Approve a blood request
// @access  Private (Blood Bank)
router.post('/requests/:id/approve', bloodBankAuth, async (req, res) => {
  try {
    const { responseNote } = req.body;
    
    const request = await BloodRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' });
    }

    // Update request with blood bank response
    request.status = 'approved';
    request.bloodBank = req.bloodBank.bloodBankId;
    request.bloodBankResponse = {
      status: 'approved',
      respondedAt: new Date(),
      respondedBy: req.bloodBank.bloodBankId,
      responseNote: responseNote || 'Request approved. Please contact us for collection.'
    };

    await request.save();

    // Populate for response
    await request.populate('requestedBy', 'name email phone');
    await request.populate('bloodBank', 'name phone email address');

    res.json({
      success: true,
      message: 'Blood request approved successfully',
      request
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/bloodbank/requests/:id/reject
// @desc    Reject a blood request
// @access  Private (Blood Bank)
router.post('/requests/:id/reject', bloodBankAuth, async (req, res) => {
  try {
    const { responseNote } = req.body;
    
    const request = await BloodRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending' });
    }

    // Update request with blood bank response
    request.status = 'rejected';
    request.bloodBank = req.bloodBank.bloodBankId;
    request.bloodBankResponse = {
      status: 'rejected',
      respondedAt: new Date(),
      respondedBy: req.bloodBank.bloodBankId,
      responseNote: responseNote || 'Unable to fulfill this request at this time.'
    };

    await request.save();

    // Populate for response
    await request.populate('requestedBy', 'name email phone');
    await request.populate('bloodBank', 'name phone email');

    res.json({
      success: true,
      message: 'Blood request rejected',
      request
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/requests/stats
// @desc    Get blood request statistics for dashboard
// @access  Private (Blood Bank)
router.get('/requests/stats/summary', bloodBankAuth, async (req, res) => {
  try {
    const bloodBankId = req.bloodBank.bloodBankId;
    
    const stats = await BloodRequest.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          approved: [
            { $match: { bloodBank: bloodBankId, status: 'approved' } },
            { $count: 'count' }
          ],
          rejected: [
            { $match: { bloodBank: bloodBankId, status: 'rejected' } },
            { $count: 'count' }
          ],
          byBloodGroup: [
            { $match: { status: 'pending' } },
            { $group: { _id: '$bloodGroup', count: { $sum: 1 } } }
          ],
          byUrgency: [
            { $match: { status: 'pending' } },
            { $group: { _id: '$urgency', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        total: stats[0].total[0]?.count || 0,
        pending: stats[0].pending[0]?.count || 0,
        approved: stats[0].approved[0]?.count || 0,
        rejected: stats[0].rejected[0]?.count || 0,
        byBloodGroup: stats[0].byBloodGroup,
        byUrgency: stats[0].byUrgency
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== EVENT MANAGEMENT ====================

// @route   GET /api/bloodbank/events
// @desc    Get all events organized by this blood bank
// @access  Private (Blood Bank)
router.get('/events', bloodBankAuth, async (req, res) => {
  try {
    const events = await Event.find({ 
      organizedBy: req.bloodBank.bloodBankId,
      organizerModel: 'BloodBank'
    })
    .populate('registeredDonors', 'name email phone bloodGroup')
    .sort({ date: 1 });

    res.json({ success: true, count: events.length, events });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/bloodbank/events
// @desc    Create a new event (visible to donors and patients)
// @access  Private (Blood Bank)
router.post('/events', bloodBankAuth, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    const eventData = {
      ...req.body,
      organizer: bloodBank.name,
      organizedBy: req.bloodBank.bloodBankId,
      organizerModel: 'BloodBank',
      visibility: req.body.visibility || 'public' // public by default
    };

    const event = new Event(eventData);
    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully and is now visible to users',
      event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/bloodbank/events/:id
// @desc    Update an event
// @access  Private (Blood Bank)
router.put('/events/:id', bloodBankAuth, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizedBy: req.bloodBank.bloodBankId
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'eventType', 'location', 'date',
      'startTime', 'endTime', 'contactInfo', 'expectedDonors',
      'isActive', 'visibility', 'maxParticipants'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/bloodbank/events/:id
// @desc    Delete/Cancel an event
// @access  Private (Blood Bank)
router.delete('/events/:id', bloodBankAuth, async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      organizedBy: req.bloodBank.bloodBankId
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/events/:id/registrations
// @desc    Get all registrations for an event
// @access  Private (Blood Bank)
router.get('/events/:id/registrations', bloodBankAuth, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizedBy: req.bloodBank.bloodBankId
    }).populate('registeredDonors', 'name email phone bloodGroup address lastDonationDate isDonor donorInfo');

    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }

    res.json({
      success: true,
      event: {
        title: event.title,
        date: event.date,
        location: event.location
      },
      registrations: event.registeredDonors,
      count: event.registeredDonors.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/events/:id/export-registrations
// @desc    Export event registrations to Excel file
// @access  Private (Blood Bank)
router.get('/events/:id/export-registrations', bloodBankAuth, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizedBy: req.bloodBank.bloodBankId
    }).populate('registeredDonors', 'name email phone bloodGroup address lastDonationDate isDonor donorInfo createdAt');

    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Event Registrations');

    // Add event details header
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = `Event: ${event.title}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Date: ${new Date(event.date).toLocaleDateString()} | Location: ${event.location?.name || 'N/A'}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Add headers
    worksheet.getRow(4).values = [
      'S.No',
      'Name',
      'Email',
      'Phone',
      'Blood Group',
      'Address',
      'Last Donation',
      'Registration Date',
      'Health Status',
      'Notes'
    ];
    
    // Style headers
    worksheet.getRow(4).font = { bold: true };
    worksheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE74C3C' }
    };
    worksheet.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    event.registeredDonors.forEach((donor, index) => {
      const row = worksheet.addRow([
        index + 1,
        donor.name || 'N/A',
        donor.email || 'N/A',
        donor.phone || 'N/A',
        donor.bloodGroup || 'N/A',
        donor.address || 'N/A',
        donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : 'Never',
        new Date(donor.createdAt).toLocaleDateString(),
        donor.isDonor ? 'Active Donor' : 'New Registration',
        donor.donorInfo?.diseases?.length > 0 ? `Diseases: ${donor.donorInfo.diseases.join(', ')}` : 'No health issues reported'
      ]);
      
      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' }
        };
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Add summary at the bottom
    const summaryRow = worksheet.addRow([]);
    summaryRow.getCell(1).value = 'Total Registrations:';
    summaryRow.getCell(2).value = event.registeredDonors.length;
    summaryRow.font = { bold: true };

    // Set response headers for file download
    const fileName = `${event.title.replace(/\s+/g, '_')}_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting registrations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== BLOOD CAMP MANAGEMENT ====================

// @route   GET /api/bloodbank/camps
// @desc    Get all blood camps for this blood bank
// @access  Private (Blood Bank)
router.get('/camps', bloodBankAuth, async (req, res) => {
  try {
    console.log('Blood bank requesting camps. ID:', req.bloodBank.bloodBankId);
    
    const camps = await BloodCamp.find({ organizer: req.bloodBank.bloodBankId })
      .sort({ date: -1 });
    
    console.log(`Fetched ${camps.length} camps for blood bank ${req.bloodBank.bloodBankId}`);
    
    if (camps.length > 0) {
      console.log('Sample camp:', {
        name: camps[0].name,
        date: camps[0].date,
        organizer: camps[0].organizer
      });
    }
    
    res.json({
      success: true,
      camps
    });
  } catch (error) {
    console.error('Error fetching camps:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/camps/:id/registrations
// @desc    Get registrations for a specific blood camp
// @access  Private (Blood Bank)
router.get('/camps/:id/registrations', bloodBankAuth, async (req, res) => {
  try {
    const camp = await BloodCamp.findOne({
      _id: req.params.id,
      organizer: req.bloodBank.bloodBankId
    });

    if (!camp) {
      return res.status(404).json({ message: 'Blood camp not found or unauthorized' });
    }

    console.log(`Camp registrations for ${camp.name}:`, camp.registeredDonors.length, 'donors');
    console.log('Registration data:', JSON.stringify(camp.registeredDonors, null, 2));

    res.json({
      success: true,
      camp: {
        name: camp.name,
        date: camp.date,
        venue: camp.venue,
        city: camp.city
      },
      registrations: camp.registeredDonors,
      count: camp.registeredDonors.length
    });
  } catch (error) {
    console.error('Error fetching camp registrations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/bloodbank/camps/:id/registrations/:donorId
// @desc    Remove a specific donor registration from a camp
// @access  Private (Blood Bank)
router.delete('/camps/:id/registrations/:donorId', bloodBankAuth, async (req, res) => {
  try {
    const camp = await BloodCamp.findOne({
      _id: req.params.id,
      organizer: req.bloodBank.bloodBankId
    });

    if (!camp) {
      return res.status(404).json({ message: 'Blood camp not found or unauthorized' });
    }

    console.log('Attempting to delete donor:', req.params.donorId);
    console.log('Current registrations:', camp.registeredDonors.length);

    // Find and remove the donor - try both _id and donor (user reference)
    const initialLength = camp.registeredDonors.length;
    const donorIdToRemove = req.params.donorId;
    
    camp.registeredDonors = camp.registeredDonors.filter(donor => {
      const donorSubdocId = donor._id ? donor._id.toString() : null;
      const donorUserId = donor.donor ? donor.donor.toString() : null;
      
      // Keep donors that don't match the ID we want to remove
      return donorSubdocId !== donorIdToRemove && donorUserId !== donorIdToRemove;
    });

    if (camp.registeredDonors.length === initialLength) {
      console.log('Donor not found. Tried to match:', donorIdToRemove);
      return res.status(404).json({ 
        message: 'Donor registration not found',
        debug: { attemptedId: donorIdToRemove, totalRegistrations: initialLength }
      });
    }

    await camp.save();

    console.log(`✅ Removed donor ${donorIdToRemove} from camp ${camp.name}`);
    console.log(`Remaining registrations: ${camp.registeredDonors.length}`);

    res.json({
      success: true,
      message: 'Donor registration removed successfully',
      remainingRegistrations: camp.registeredDonors.length
    });
  } catch (error) {
    console.error('Error deleting donor registration:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/camps/:id/export-registrations
// @desc    Export camp registrations to Excel
// @access  Private (Blood Bank)
router.get('/camps/:id/export-registrations', bloodBankAuth, async (req, res) => {
  try {
    const camp = await BloodCamp.findOne({
      _id: req.params.id,
      organizer: req.bloodBank.bloodBankId
    }).populate('registeredDonors.donor', 'name email phone bloodGroup address');

    if (!camp) {
      return res.status(404).json({ message: 'Blood camp not found or unauthorized' });
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Camp Registrations');

    // Add headers
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Blood Group', key: 'bloodGroup', width: 12 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Registered At', key: 'registeredAt', width: 20 }
    ];

    // Add data
    camp.registeredDonors.forEach((registration, index) => {
      worksheet.addRow({
        sno: index + 1,
        name: registration.name || 'N/A',
        bloodGroup: registration.bloodGroup || 'N/A',
        phone: registration.phone || 'N/A',
        email: registration.donor?.email || 'N/A',
        registeredAt: new Date(registration.registeredAt).toLocaleString()
      });
    });

    // Style the header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE63946' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=camp_${camp.name.replace(/[^a-z0-9]/gi, '_')}_registrations.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exporting camp registrations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SETTINGS ====================

// @route   POST /api/bloodbank/settings/photo
// @desc    Upload blood bank photo
// @access  Private (Blood Bank)
router.post('/settings/photo', bloodBankAuth, async (req, res) => {
  try {
    const { photo } = req.body;
    
    if (!photo) {
      return res.status(400).json({ message: 'No photo provided' });
    }

    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    bloodBank.profileImage = photo;
    await bloodBank.save();

    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photo: bloodBank.profileImage
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== DASHBOARD & ANALYTICS ====================

// @route   GET /api/bloodbank/dashboard
// @desc    Get dashboard data for blood bank
// @access  Private (Blood Bank)
router.get('/dashboard', bloodBankAuth, async (req, res) => {
  try {
    const bloodBankId = req.bloodBank.bloodBankId;

    // Get blood bank details with inventory
    const bloodBank = await BloodBank.findById(bloodBankId);

    // Get request statistics
    const requestStats = await BloodRequest.aggregate([
      {
        $facet: {
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          approved: [
            { $match: { bloodBank: bloodBankId, status: 'approved' } },
            { $count: 'count' }
          ],
          thisMonth: [
            { 
              $match: { 
                bloodBank: bloodBankId,
                createdAt: { 
                  $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
                }
              } 
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Get event statistics
    const eventStats = await Event.aggregate([
      {
        $match: {
          organizedBy: bloodBankId,
          organizerModel: 'BloodBank'
        }
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          upcoming: [
            { $match: { date: { $gte: new Date() }, isActive: true } },
            { $count: 'count' }
          ],
          totalRegistrations: [
            { $unwind: '$registeredDonors' },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      dashboard: {
        bloodBank: {
          name: bloodBank.name,
          inventory: bloodBank.inventory
        },
        requests: {
          pending: requestStats[0].pending[0]?.count || 0,
          approved: requestStats[0].approved[0]?.count || 0,
          thisMonth: requestStats[0].thisMonth[0]?.count || 0
        },
        events: {
          total: eventStats[0].total[0]?.count || 0,
          upcoming: eventStats[0].upcoming[0]?.count || 0,
          totalRegistrations: eventStats[0].totalRegistrations[0]?.count || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SETTINGS & PROFILE MANAGEMENT ====================

// @route   GET /api/bloodbank/settings/profile
// @desc    Get blood bank profile details
// @access  Private (Blood Bank)
router.get('/settings/profile', bloodBankAuth, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId).select('-password');
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    res.json({ success: true, bloodBank });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/bloodbank/settings/profile
// @desc    Update blood bank profile
// @access  Private (Blood Bank)
router.put('/settings/profile', bloodBankAuth, async (req, res) => {
  try {
    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    // Fields allowed to update
    const allowedUpdates = [
      'name', 'phone', 'logo', 'imageUrl', 'address', 'location',
      'operatingHours', 'services', 'contactPerson', 'establishedYear'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        bloodBank[field] = req.body[field];
      }
    });

    await bloodBank.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      bloodBank: await BloodBank.findById(bloodBank._id).select('-password')
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/bloodbank/settings/password
// @desc    Change blood bank password
// @access  Private (Blood Bank)
router.put('/settings/password', bloodBankAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    // Verify current password
    const isMatch = await bloodBank.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    bloodBank.password = newPassword;
    await bloodBank.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/bloodbank/settings/inventory
// @desc    Get blood inventory
// @access  Private (Blood Bank)
router.get('/settings/inventory', bloodBankAuth, async (req, res) => {
  try {
    let inventory = await Inventory.findOne({ bloodBank: req.bloodBank.bloodBankId });
    
    if (!inventory) {
      console.log('⚠️  No inventory found for blood bank:', req.bloodBank.bloodBankId);
      console.log('📦 Returning empty inventory - will be created on first save');
      
      // Return empty inventory structure - don't create in DB yet
      // Let the frontend send the initial save to create it
      const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const emptyInventory = bloodGroups.map(group => ({
        bloodGroup: group,
        units: 0,
        lastUpdated: new Date()
      }));
      
      return res.json({
        success: true,
        inventory: emptyInventory,
        isNew: true
      });
    }

    console.log('✅ Found existing inventory for blood bank:', req.bloodBank.bloodBankId);
    console.log('📊 Inventory items:', inventory.items.map(item => `${item.bloodGroup}: ${item.units}`).join(', '));

    res.json({
      success: true,
      inventory: inventory.items || [],
      isNew: false
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/bloodbank/settings/inventory
// @desc    Update blood inventory
// @access  Private (Blood Bank)
router.put('/settings/inventory', bloodBankAuth, async (req, res) => {
  try {
    const { inventory } = req.body;

    console.log('📦 Inventory update request:', {
      bloodBankId: req.bloodBank.bloodBankId,
      inventoryCount: inventory?.length,
      items: inventory
    });

    if (!Array.isArray(inventory)) {
      return res.status(400).json({ message: 'Inventory must be an array' });
    }

    // Validate inventory items have required fields
    const validatedInventory = inventory.map(item => ({
      bloodGroup: item.bloodGroup || item.type, // Support both field names
      units: parseInt(item.units) || 0,
      lastUpdated: new Date()
    }));

    console.log('✅ Validated inventory:', validatedInventory);

    let inventoryDoc = await Inventory.findOne({ bloodBank: req.bloodBank.bloodBankId });
    
    if (!inventoryDoc) {
      // Create new inventory if not exists
      const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
      if (!bloodBank) {
        return res.status(404).json({ message: 'Blood bank not found' });
      }

      console.log('📝 Creating new inventory document');
      inventoryDoc = new Inventory({
        bloodBank: req.bloodBank.bloodBankId,
        bloodBankName: bloodBank.name,
        items: validatedInventory
      });
    } else {
      console.log('📝 Updating existing inventory document');
      inventoryDoc.items = validatedInventory;
      inventoryDoc.markModified('items'); // Force Mongoose to save the array
    }

    const savedDoc = await inventoryDoc.save();
    console.log(`✅ Inventory saved successfully for blood bank ${req.bloodBank.bloodBankId}`);
    console.log('📊 Final saved items:', savedDoc.items.map(item => `${item.bloodGroup}: ${item.units}`).join(', '));

    res.json({
      success: true,
      message: 'Inventory updated successfully',
      inventory: savedDoc.items
    });
  } catch (error) {
    console.error('❌ Error updating inventory:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/bloodbank/settings/inventory/:bloodGroup
// @desc    Update specific blood group units
// @access  Private (Blood Bank)
router.patch('/settings/inventory/:bloodGroup', bloodBankAuth, async (req, res) => {
  try {
    const { bloodGroup } = req.params;
    const { units } = req.body;

    if (units === undefined || units < 0) {
      return res.status(400).json({ message: 'Please provide valid units (>=0)' });
    }

    const bloodBank = await BloodBank.findById(req.bloodBank.bloodBankId);
    
    if (!bloodBank) {
      return res.status(404).json({ message: 'Blood bank not found' });
    }

    // Find and update specific blood group
    const inventoryItem = bloodBank.inventory.find(item => item.bloodGroup === bloodGroup);
    
    if (inventoryItem) {
      inventoryItem.units = units;
      inventoryItem.lastUpdated = new Date();
    } else {
      // Add new blood group if not exists
      bloodBank.inventory.push({
        bloodGroup,
        units,
        lastUpdated: new Date()
      });
    }

    await bloodBank.save();

    res.json({
      success: true,
      message: `${bloodGroup} inventory updated to ${units} units`,
      inventory: bloodBank.inventory
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

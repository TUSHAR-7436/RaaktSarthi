import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestAPI, bloodBankPortalAPI } from '../services/api';
import { useToast } from '../components/ToastContainer';
import MapModal from '../components/MapModal';
import './BloodBankDashboard.css';

const BloodBankDashboard = () => {
  const navigate = useNavigate();
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [bloodBank, setBloodBank] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [inventory, setInventory] = useState([
    { type: 'A+', units: 0, status: 'critical' },
    { type: 'A-', units: 0, status: 'critical' },
    { type: 'B+', units: 0, status: 'critical' },
    { type: 'B-', units: 0, status: 'critical' },
    { type: 'AB+', units: 0, status: 'critical' },
    { type: 'AB-', units: 0, status: 'critical' },
    { type: 'O+', units: 0, status: 'critical' },
    { type: 'O-', units: 0, status: 'critical' }
  ]);
  const [camps, setCamps] = useState([]);
  const [requests, setRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingApprovedRequests, setLoadingApprovedRequests] = useState(false);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [showCampModal, setShowCampModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [showCampDetails, setShowCampDetails] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [bloodBanksList, setBloodBanksList] = useState([]);
  const [loadingBloodBanks, setLoadingBloodBanks] = useState(false);
  const [selectedBloodBank, setSelectedBloodBank] = useState(null);
  const [showBloodBankDetails, setShowBloodBankDetails] = useState(false);
  const [bloodBankPhoto, setBloodBankPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingInventory, setSavingInventory] = useState(false);
  const [inventorySaveError, setInventorySaveError] = useState('');
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [requestsSubTab, setRequestsSubTab] = useState('pending'); // 'pending' or 'approved'
  const [campForm, setCampForm] = useState({
    name: '',
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    venue: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null,
    longitude: null,
    targetUnits: 100,
    description: ''
  });
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [gettingBankLocation, setGettingBankLocation] = useState(false);
  const [bankLocation, setBankLocation] = useState(null);
  const [showBankMapModal, setShowBankMapModal] = useState(false);

  useEffect(() => {
    // Check if blood bank is logged in
    const token = localStorage.getItem('bloodBankToken');
    const data = localStorage.getItem('bloodBankData');
    
    if (!token || !data) {
      navigate('/blood-bank/login');
      return;
    }

    const bloodBankData = JSON.parse(data);
    setBloodBank(bloodBankData);
    
    // Load photo from blood bank data first (backend)
    if (bloodBankData.profileImage) {
      setPhotoPreview(bloodBankData.profileImage);
    } else {
      // Fallback to localStorage
      const savedPhoto = localStorage.getItem(`bloodBankPhoto_${bloodBankData.id || bloodBankData._id || 'default'}`);
      if (savedPhoto) {
        setPhotoPreview(savedPhoto);
      }
    }
    
    // Load location if available
    if (bloodBankData.location?.coordinates && 
        (bloodBankData.location.coordinates[0] !== 0 || bloodBankData.location.coordinates[1] !== 0)) {
      setBankLocation({
        type: 'Point',
        coordinates: bloodBankData.location.coordinates
      });
    }
    
    // First try to load from localStorage immediately (no delay)
    const bloodBankId = bloodBankData.id || bloodBankData._id || 'default';
    const savedInventory = localStorage.getItem(`inventory_${bloodBankId}`);
    if (savedInventory) {
      try {
        const parsedInventory = JSON.parse(savedInventory);
        if (parsedInventory && parsedInventory.length > 0) {
          setInventory(parsedInventory);
        }
      } catch (e) {
        console.error('Error parsing saved inventory:', e);
      }
    }
    
    // Then fetch from backend (will update if different)
    fetchInventory(bloodBankData);
    
    // Fetch fresh profile data from backend
    fetchBloodBankProfile();
    
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Fetch approved requests when switching to approved subtab
  useEffect(() => {
    if (activeTab === 'requests' && requestsSubTab === 'approved') {
      fetchApprovedRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, requestsSubTab]);

  const fetchInventory = async (bankData = bloodBank) => {
    try {
      console.log('Fetching inventory from backend...');
      const response = await bloodBankPortalAPI.getInventory();
      console.log('Backend inventory response:', response.data);
      
      if (response.data.success && response.data.inventory && response.data.inventory.length > 0) {
        // Map backend bloodGroup to frontend type
        const mappedInventory = response.data.inventory.map(item => ({
          type: item.bloodGroup || item.type,
          units: item.units || 0,
          status: item.units > 10 ? 'good' : item.units > 5 ? 'low' : 'critical',
          lastUpdated: item.lastUpdated
        }));
        console.log('Mapped inventory from backend:', mappedInventory);
        setInventory(mappedInventory);
        
        // Save to localStorage as backup
        const bloodBankId = bankData?.id || bankData?._id || 'default';
        localStorage.setItem(`inventory_${bloodBankId}`, JSON.stringify(mappedInventory));
        console.log('Saved to localStorage with key:', `inventory_${bloodBankId}`);
      } else {
        // If backend returns empty inventory, try localStorage
        console.log('Backend returned empty inventory, checking localStorage...');
        const bloodBankId = bankData?.id || bankData?._id || 'default';
        const savedInventory = localStorage.getItem(`inventory_${bloodBankId}`);
        console.log('LocalStorage inventory:', savedInventory);
        if (savedInventory) {
          const parsedInventory = JSON.parse(savedInventory);
          setInventory(parsedInventory);
          
          // Sync localStorage data back to backend if it has real data
          const hasRealData = parsedInventory.some(item => item.units > 0);
          if (hasRealData) {
            console.log('Syncing localStorage data back to backend...');
            try {
              await saveInventoryToBackend(parsedInventory);
              console.log('Backend synced with localStorage data');
            } catch (syncError) {
              console.error('Failed to sync to backend:', syncError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      console.error('Error details:', error.response?.data || error.message);
      // If backend fails, try localStorage as fallback
      const bloodBankId = bankData?.id || bankData?._id || 'default';
      const savedInventory = localStorage.getItem(`inventory_${bloodBankId}`);
      console.log('Using localStorage fallback:', savedInventory);
      if (savedInventory) {
        setInventory(JSON.parse(savedInventory));
      }
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(false);
      await Promise.all([
        fetchRequests(),
        fetchCamps()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const fetchBloodBankProfile = async () => {
    try {
      const response = await bloodBankPortalAPI.getProfile();
      const profileData = response.data.bloodBank || response.data;
      
      // Update photo from backend
      if (profileData.profileImage) {
        setPhotoPreview(profileData.profileImage);
        // Also save to localStorage
        const bloodBankId = profileData._id || 'default';
        localStorage.setItem(`bloodBankPhoto_${bloodBankId}`, profileData.profileImage);
      }
      
      // Update location from backend
      if (profileData.location?.coordinates && 
          (profileData.location.coordinates[0] !== 0 || profileData.location.coordinates[1] !== 0)) {
        setBankLocation({
          type: 'Point',
          coordinates: profileData.location.coordinates
        });
      }
      
      // Update bloodBank state with latest data
      setBloodBank(prev => ({ ...prev, ...profileData }));
      
      // Update localStorage
      const existingData = JSON.parse(localStorage.getItem('bloodBankData') || '{}');
      localStorage.setItem('bloodBankData', JSON.stringify({ ...existingData, ...profileData }));
    } catch (err) {
      console.error('Error fetching blood bank profile:', err);
    }
  };

  const handleGetBankLocation = () => {
    if (!navigator.geolocation) {
      error('Geolocation is not supported by your browser');
      return;
    }

    setGettingBankLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLocation = {
          type: 'Point',
          coordinates: [position.coords.longitude, position.coords.latitude]
        };
        
        try {
          // Save to backend
          await bloodBankPortalAPI.updateProfile({ location: newLocation });
          
          setBankLocation(newLocation);
          
          // Update localStorage
          const bloodBankData = JSON.parse(localStorage.getItem('bloodBankData') || '{}');
          bloodBankData.location = newLocation;
          localStorage.setItem('bloodBankData', JSON.stringify(bloodBankData));
          
          success('Location captured successfully!');
        } catch (err) {
          console.error('Error saving location:', err);
          error('Failed to save location. Please try again.');
        } finally {
          setGettingBankLocation(false);
        }
      },
      (err) => {
        setGettingBankLocation(false);
        error(`Unable to retrieve location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      // Fetch all pending requests from the system
      const response = await requestAPI.getAll({ status: 'pending' });
      setRequests(response.data || []);
      setLoadingRequests(false);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setRequests([]);
      setLoadingRequests(false);
    }
  };

  const fetchApprovedRequests = async () => {
    try {
      setLoadingApprovedRequests(true);
      const response = await bloodBankPortalAPI.getApprovedRequests();
      setApprovedRequests(response.data.requests || []);
      setLoadingApprovedRequests(false);
    } catch (error) {
      console.error('Error fetching approved requests:', error);
      setApprovedRequests([]);
      setLoadingApprovedRequests(false);
    }
  };

  const fetchCamps = async () => {
    try {
      setLoadingCamps(true);
      const response = await bloodBankPortalAPI.getCamps();
      console.log('Fetched camps:', response.data);
      
      // Extract camps from response (check if it's in camps property or directly in data)
      const campsData = response.data.camps || response.data || [];
      setCamps(campsData);
      setLoadingCamps(false);
    } catch (error) {
      console.error('Error fetching camps:', error);
      setCamps([]);
      setLoadingCamps(false);
    }
  };



  const handleLogout = () => {
    localStorage.removeItem('bloodBankToken');
    localStorage.removeItem('bloodBankData');
    navigate('/blood-bank/login');
  };

  const handleCampFormChange = (e) => {
    setCampForm({
      ...campForm,
      [e.target.name]: e.target.value
    });
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      error('Geolocation is not supported by your browser');
      return;
    }
    
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCampForm(prev => ({ ...prev, latitude, longitude }));
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                'User-Agent': 'RaktSarthi Blood Bank System'
              }
            }
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch address');
          }
          
          const data = await response.json();
          
          if (data && data.address) {
            setCampForm(prev => ({
              ...prev,
              address: data.address.road || data.address.suburb || data.display_name || '',
              city: data.address.city || data.address.town || data.address.village || data.address.county || '',
              state: data.address.state || '',
              pincode: data.address.postcode || ''
            }));
            success('Location fetched successfully!');
          } else {
            warning('Location coordinates captured, but address details could not be retrieved. Please enter manually.');
          }
        } catch (err) {
          console.error('Error reverse geocoding:', err);
          warning('Location coordinates captured, but address could not be retrieved. Please enter address manually.');
        } finally {
          setFetchingLocation(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMessage = 'Unable to retrieve your location. ';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again or enter address manually.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
        }
        
        error(errorMessage);
        setFetchingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000
      }
    );
  };

  const handleDeleteCamp = (campId) => {
    if (window.confirm('Are you sure you want to delete this camp?')) {
      const deletedCamp = camps.find(c => c.id === campId);
      setCamps(prev => prev.filter(camp => camp.id !== campId));
      setActiveDropdown(null);
      if (deletedCamp) {
        addNotification(`Camp "${deletedCamp.name}" has been deleted`);
      }
    }
  };

  const handleViewCamp = (camp) => {
    setSelectedCamp(camp);
    setShowCampDetails(true);
    setActiveDropdown(null);
  };

  const handleViewRegistrations = async (camp) => {
    try {
      // Fetch the latest camp data with registrations
      const response = await bloodBankPortalAPI.getCampRegistrations(camp._id);
      
      if (response.data.success) {
        // Update the selected camp with fresh registration data
        const updatedCamp = {
          ...camp,
          registeredDonors: response.data.registrations || []
        };
        setSelectedCamp(updatedCamp);
      } else {
        setSelectedCamp(camp);
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
      // Fallback to camp data we have
      setSelectedCamp(camp);
    }
    
    setShowRegistrations(true);
    setActiveDropdown(null);
  };

  const handleDeleteDonor = async (campId, donorId) => {
    if (!window.confirm('Are you sure you want to remove this donor registration?')) {
      return;
    }

    console.log('Deleting donor:', { campId, donorId });

    try {
      const response = await bloodBankPortalAPI.deleteCampRegistration(campId, donorId);
      
      console.log('Delete response:', response.data);
      
      // Refresh the registrations
      const refreshResponse = await bloodBankPortalAPI.getCampRegistrations(campId);
      
      if (refreshResponse.data.success) {
        const updatedCamp = {
          ...selectedCamp,
          registeredDonors: refreshResponse.data.registrations || []
        };
        setSelectedCamp(updatedCamp);
        
        // Also update the camps list
        setCamps(camps.map(camp => 
          camp._id === campId 
            ? { ...camp, registeredDonors: refreshResponse.data.registrations || [] }
            : camp
        ));
        
        addNotification('Donor registration removed successfully');
      }
    } catch (err) {
      console.error('Error deleting donor:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg = err.response?.data?.message || 'Failed to remove donor registration';
      error(errorMsg);
    }
  };

  const handleApproveRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this blood request?')) {
      return;
    }
    
    try {
      // Find the request to get blood group and units
      const request = requests.find(req => req._id === requestId);
      
      if (request) {
        // Update inventory by decreasing units
        const updatedInventory = inventory.map(inv => 
          inv.type === request.bloodGroup
            ? {
                ...inv,
                units: Math.max(0, inv.units - request.units),
                status: (inv.units - request.units) < 10 ? 'critical' : 
                        (inv.units - request.units) < 20 ? 'low' : 'good'
              }
            : inv
        );
        setInventory(updatedInventory);
        
        // Save inventory to backend
        await saveInventoryToBackend(updatedInventory);
      }
      
      await bloodBankPortalAPI.approveRequest(requestId, {
        responseNote: 'Request approved. Blood units are available.'
      });
      
      // Update the requests list by removing the approved request
      setRequests(requests.filter(req => req._id !== requestId));
      
      addNotification('Blood request approved successfully');
    } catch (error) {
      console.error('Error approving request:', error);
      addNotification('Failed to approve request. Please try again.');
    }
  };

  // Handle Save Inventory button click
  const handleSaveInventory = async () => {
    setSavingInventory(true);
    setInventorySaveError('');
    
    try {
      // Map frontend type to backend bloodGroup
      const backendInventory = inventory.map(item => ({
        bloodGroup: item.type || item.bloodGroup,
        units: item.units,
        lastUpdated: new Date()
      }));
      
      console.log('Saving inventory to backend:', backendInventory);
      
      // Save to backend database
      const response = await bloodBankPortalAPI.updateInventory({ inventory: backendInventory });
      console.log('Backend save response:', response.data);
      
      if (response.data.success) {
        // Also save to localStorage as backup
        const bloodBankId = bloodBank?.id || bloodBank?._id || 'default';
        localStorage.setItem(`inventory_${bloodBankId}`, JSON.stringify(inventory));
        console.log('Saved to localStorage with key:', `inventory_${bloodBankId}`);
        
        addNotification('Inventory saved successfully!');
        
        // No need to refetch - we already have the latest data
        // await fetchInventory(bloodBank);
      } else {
        throw new Error(response.data.message || 'Failed to save inventory');
      }
    } catch (error) {
      console.error('Error saving inventory:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save inventory. Please try again.';
      setInventorySaveError(errorMessage);
      
      // Still save to localStorage even if backend fails
      const bloodBankId = bloodBank?.id || bloodBank?._id || 'default';
      localStorage.setItem(`inventory_${bloodBankId}`, JSON.stringify(inventory));
      console.log('Saved to localStorage as fallback');
    } finally {
      setSavingInventory(false);
    }
  };

  const saveInventoryToBackend = async (updatedInventory) => {
    if (isSavingInventory) {
      console.log('⏳ Already saving, skipping duplicate save');
      return;
    }

    setIsSavingInventory(true);
    try {
      // Map frontend type to backend bloodGroup
      const backendInventory = updatedInventory.map(item => ({
        bloodGroup: item.type || item.bloodGroup,
        units: item.units,
        lastUpdated: new Date()
      }));
      
      console.log('Saving inventory to backend:', backendInventory);
      
      // Save to backend database
      const response = await bloodBankPortalAPI.updateInventory({ inventory: backendInventory });
      console.log('Backend save response:', response.data);
      
      // Also save to localStorage as backup
      const bloodBankId = bloodBank?.id || bloodBank?._id || 'default';
      localStorage.setItem(`inventory_${bloodBankId}`, JSON.stringify(updatedInventory));
      console.log('Saved to localStorage with key:', `inventory_${bloodBankId}`);
    } catch (error) {
      console.error('Error saving inventory:', error);
      console.error('Error details:', error.response?.data || error.message);
      addNotification('Failed to save inventory changes');
      
      // Still save to localStorage even if backend fails
      const bloodBankId = bloodBank?.id || bloodBank?._id || 'default';
      localStorage.setItem(`inventory_${bloodBankId}`, JSON.stringify(updatedInventory));
      console.log('Saved to localStorage as fallback');
    } finally {
      setIsSavingInventory(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error('File size should not exceed 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      error('Please select an image file');
      return;
    }

    setBloodBankPhoto(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!bloodBankPhoto && !photoPreview) {
      warning('Please select a photo first');
      return;
    }

    try {
      setUploadingPhoto(true);
      
      // Upload to backend
      const bloodBankId = bloodBank?._id || 'default';
      await bloodBankPortalAPI.uploadPhoto({ photo: photoPreview });
      
      // Also save to localStorage for immediate preview
      localStorage.setItem(`bloodBankPhoto_${bloodBankId}`, photoPreview);
      
      addNotification('Hospital photo uploaded successfully!');
      success('Hospital photo uploaded successfully!');
      setBloodBankPhoto(null);
    } catch (err) {
      console.error('Error uploading photo:', err);
      error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    const reason = window.prompt('Please provide a reason for rejection (optional):');
    
    if (reason === null) {
      // User cancelled
      return;
    }
    
    try {
      await bloodBankPortalAPI.rejectRequest(requestId, {
        responseNote: reason || 'Request rejected due to unavailability of blood units.'
      });
      
      // Update the requests list by removing the rejected request
      setRequests(requests.filter(req => req._id !== requestId));
      
      addNotification('Blood request rejected');
    } catch (error) {
      console.error('Error rejecting request:', error);
      addNotification('Failed to reject request. Please try again.');
    }
  };

  const handleCreateCamp = async (e) => {
    e.preventDefault();
    try {
      console.log('Creating blood camp with data:', campForm);
      
      // Create camp data for BloodCamp collection
      const campData = {
        name: campForm.name,
        date: campForm.date,
        startTime: campForm.startTime,
        endTime: campForm.endTime,
        venue: campForm.venue,
        address: campForm.address,
        city: campForm.city,
        state: campForm.state,
        pincode: campForm.pincode,
        targetUnits: campForm.targetUnits,
        description: campForm.description,
        contactPhone: bloodBank?.phone || '',
        contactEmail: bloodBank?.email || ''
      };

      // Send to backend API
      console.log('Sending camp data to API:', campData);
      const response = await bloodBankPortalAPI.createCamp(campData);
      console.log('Camp created response:', response.data);
      
      // Refresh camps list from backend
      await fetchCamps();
      setShowCampModal(false);
      
      // Add notification
      addNotification(`New blood camp "${campForm.name}" created successfully and is now visible to donors!`);
      
      setCampForm({
        name: '',
        date: '',
        startTime: '09:00',
        endTime: '17:00',
        venue: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        latitude: null,
        longitude: null,
        targetUnits: 100,
        description: ''
      });
      success('Blood camp created successfully!');
    } catch (err) {
      console.error('Error creating camp:', err);
      error('Failed to create camp. Please try again.');
    }
  };

  const addNotification = (message) => {
    const newNotif = {
      message,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const updateInventory = (type, change) => {
    setInventory(prev => {
      const updated = prev.map(item => {
        if (item.type === type) {
          const newUnits = Math.max(0, item.units + change);
          let status = 'good';
          if (newUnits <= 5) status = 'critical';
          else if (newUnits <= 10) status = 'low';
          return { ...item, units: newUnits, status };
        }
        return item;
      });
      
      // Mark as changed and save to backend (non-blocking)
      saveInventoryToBackend(updated);
      
      return updated;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return '#16a34a';
      case 'low': return '#f59e0b';
      case 'critical': return '#dc2626';
      default: return '#666';
    }
  };

  const totalUnits = inventory.reduce((sum, item) => sum + item.units, 0);
  const criticalTypes = inventory.filter(item => item.status === 'critical').length;
  const upcomingCamps = camps.filter(camp => camp.status !== 'completed').length;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner-large"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="blood-bank-dashboard">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <h2>{bloodBank?.name || 'Blood Bank'}</h2>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleTabChange('overview')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            Overview
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => handleTabChange('inventory')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            Inventory
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'camps' ? 'active' : ''}`}
            onClick={() => handleTabChange('camps')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Blood Camps
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => handleTabChange('requests')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Requests
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'bloodbanks' ? 'active' : ''}`}
            onClick={() => handleTabChange('bloodbanks')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Blood Banks
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="header-left">
            <h1>
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'inventory' && 'Blood Inventory'}
              {activeTab === 'camps' && 'Blood Camps'}
              {activeTab === 'requests' && 'Blood Requests'}
              {activeTab === 'bloodbanks' && 'Blood Banks Directory'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p>Welcome back, {bloodBank?.name}</p>
          </div>
          <div className="header-right">
            <div className="notification-wrapper">
              <button 
                className="notification-btn" 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h3>Notifications</h3>
                    <button onClick={() => setNotifications([])}>Clear All</button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <p>No new notifications</p>
                    </div>
                  ) : (
                    <div className="notification-list">
                      {notifications.map((notif, index) => (
                        <div key={index} className="notification-item">
                          <div className="notif-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                          <div className="notif-content">
                            <p>{notif.message}</p>
                            <span className="notif-time">{notif.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Link to="/" className="header-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Home
            </Link>
          </div>
        </header>

        <div className="dashboard-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #e63946, #d62828)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                      <path d="M2 17l10 5 10-5"/>
                      <path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <h3>{totalUnits}</h3>
                    <p>Total Units</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <h3>{criticalTypes}</h3>
                    <p>Critical Types</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <h3>{upcomingCamps}</h3>
                    <p>Upcoming Camps</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                      <path d="M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <h3>{requests.length}</h3>
                    <p>Pending Requests</p>
                  </div>
                </div>
              </div>

              <div className="overview-grid">
                <div className="overview-card">
                  <h3>Quick Inventory Status</h3>
                  <div className="mini-inventory">
                    {inventory.map(item => (
                      <div key={item.type} className="mini-inv-item">
                        <span className="blood-type">{item.type}</span>
                        <div className="inv-bar">
                          <div 
                            className="inv-bar-fill" 
                            style={{ 
                              width: `${Math.min(100, (item.units / 50) * 100)}%`,
                              background: getStatusColor(item.status)
                            }}
                          ></div>
                        </div>
                        <span className="units">{item.units}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="overview-card">
                  <h3>Upcoming Camps</h3>
                  <div className="mini-camps">
                    {camps.slice(0, 3).map(camp => (
                      <div key={camp.id} className="mini-camp-item">
                        <div className="camp-date">
                          <span className="day">{new Date(camp.date).getDate()}</span>
                          <span className="month">{new Date(camp.date).toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div className="camp-info">
                          <h4>{camp.name}</h4>
                          <p>{camp.venue}, {camp.city}</p>
                        </div>
                      </div>
                    ))}
                    {camps.length === 0 && (
                      <p className="no-data">No upcoming camps</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="inventory-content">
              <div className="inventory-actions">
                <button 
                  className={`save-inventory-btn has-changes ${savingInventory ? 'saving' : ''}`}
                  onClick={handleSaveInventory}
                  disabled={savingInventory}
                >
                  {savingInventory ? (
                    <>
                      <span className="spinner"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Save Inventory
                    </>
                  )}
                </button>
                {inventorySaveError && (
                  <div className="inventory-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {inventorySaveError}
                  </div>
                )}
              </div>
              <div className="inventory-grid">
                {inventory.map(item => (
                  <div key={item.type} className="inventory-card">
                    <div className="inv-header">
                      <span className="blood-type-large">{item.type}</span>
                      <span className={`status-badge ${item.status}`}>{item.status}</span>
                    </div>
                    <div className="inv-controls">
                      <button 
                        className="inv-btn inv-btn-decrease"
                        onClick={() => updateInventory(item.type, -1)}
                        disabled={item.units <= 0}
                        title="Decrease by 1"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                      <div className="inv-value">
                        <span className="units-number">{item.units}</span>
                        <span className="units-label">units</span>
                      </div>
                      <button 
                        className="inv-btn inv-btn-increase"
                        onClick={() => updateInventory(item.type, 1)}
                        disabled={item.units >= 100}
                        title="Increase by 1"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Camps Tab */}
          {activeTab === 'camps' && (
            <div className="camps-content">
              <div className="camps-header">
                <h2>Manage Blood Camps</h2>
                <button className="create-camp-btn" onClick={() => setShowCampModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Create New Camp
                </button>
              </div>

              <div className="camps-list">
                {loadingCamps ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading camps...</p>
                  </div>
                ) : camps.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <h3>No Blood Camps Yet</h3>
                    <p>Create your first blood camp to get started</p>
                  </div>
                ) : (
                  camps.map(camp => (
                    <div key={camp.id} className="camp-card">
                      <div className="camp-card-header">
                        <h3>{camp.name}</h3>
                        <div className="camp-header-right">
                          <span className={`camp-status ${camp.status}`}>{camp.status}</span>
                          <div className="camp-actions">
                            <button 
                              className="action-menu-btn"
                              onClick={() => setActiveDropdown(activeDropdown === camp.id ? null : camp.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2"/>
                                <circle cx="12" cy="12" r="2"/>
                                <circle cx="12" cy="19" r="2"/>
                              </svg>
                            </button>
                            {activeDropdown === camp.id && (
                              <div className="action-dropdown">
                                <button onClick={() => handleViewCamp(camp)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                  View Details
                                </button>
                                <button onClick={() => handleViewRegistrations(camp)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                                  </svg>
                                  View Registrations
                                </button>
                                <button onClick={() => handleDeleteCamp(camp.id)} className="delete-action">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                  </svg>
                                  Delete Camp
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="camp-details">
                        <div className="camp-detail">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {new Date(camp.date).toLocaleDateString()}
                        </div>
                        <div className="camp-detail">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {camp.venue}, {camp.city}
                        </div>
                      </div>
                      <div className="camp-progress">
                        <div className="progress-text">
                          <span>Registrations: {camp.registeredDonors?.length || 0} / {camp.targetUnits} donors</span>
                          <span>{Math.round(((camp.registeredDonors?.length || 0) / camp.targetUnits) * 100)}%</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${Math.min(100, ((camp.registeredDonors?.length || 0) / camp.targetUnits) * 100)}%`,
                              backgroundColor: (camp.registeredDonors?.length || 0) >= camp.targetUnits ? '#10b981' : '#e63946'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="requests-content">
              <h2>Blood Requests</h2>
              
              {/* Sub Navigation for Pending/Approved */}
              <div className="requests-sub-nav" style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #f0f0f0',
                paddingBottom: '10px'
              }}>
                <button 
                  className={`sub-nav-btn ${requestsSubTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setRequestsSubTab('pending')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: requestsSubTab === 'pending' ? '#e63946' : 'transparent',
                    color: requestsSubTab === 'pending' ? 'white' : '#666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: requestsSubTab === 'pending' ? 'bold' : 'normal',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Pending Requests
                </button>
                <button 
                  className={`sub-nav-btn ${requestsSubTab === 'approved' ? 'active' : ''}`}
                  onClick={() => setRequestsSubTab('approved')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: requestsSubTab === 'approved' ? '#e63946' : 'transparent',
                    color: requestsSubTab === 'approved' ? 'white' : '#666',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: requestsSubTab === 'approved' ? 'bold' : 'normal',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Approved Requests
                </button>
              </div>

              {/* Pending Requests */}
              {requestsSubTab === 'pending' && (
                <>
                  {loadingRequests ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <p>Loading requests...</p>
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                      </svg>
                      <h3>No Pending Requests</h3>
                      <p>No pending blood requests at the moment</p>
                    </div>
                  ) : (
                    <div className="requests-list">
                      {requests.map(request => (
                        <div key={request._id || request.id} className="request-card">
                          <div className="request-header">
                            <span className="blood-type-badge">{request.bloodGroup}</span>
                            <span className={`urgency-badge ${request.urgency}`}>{request.urgency}</span>
                          </div>
                          <div className="request-details">
                            <p><strong>Patient:</strong> {request.patientName}</p>
                            <p><strong>Hospital:</strong> {request.hospital?.name || 'N/A'}</p>
                            <p><strong>Address:</strong> {request.hospital?.address || 'N/A'}</p>
                            <p><strong>Blood Group:</strong> {request.bloodGroup}</p>
                            <p><strong>Units Required:</strong> {request.units}</p>
                            <p><strong>Contact:</strong> {request.contactNumber}</p>
                            <p><strong>Required By:</strong> {new Date(request.requiredBy).toLocaleDateString()}</p>
                            {request.description && (
                              <p><strong>Description:</strong> {request.description}</p>
                            )}
                          </div>
                          <div className="request-actions">
                            <button 
                              className="action-btn approve"
                              onClick={() => handleApproveRequest(request._id || request.id)}
                            >
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M16 4L6 14L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Approve
                            </button>
                            <button 
                              className="action-btn reject"
                              onClick={() => handleRejectRequest(request._id || request.id)}
                            >
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Approved Requests */}
              {requestsSubTab === 'approved' && (
                <>
                  {loadingApprovedRequests ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <p>Loading approved requests...</p>
                    </div>
                  ) : approvedRequests.length === 0 ? (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                      </svg>
                      <h3>No Approved Requests</h3>
                      <p>You haven't approved any requests yet</p>
                    </div>
                  ) : (
                    <div className="requests-list">
                      {approvedRequests.map(request => (
                        <div key={request._id || request.id} className="request-card approved">
                          <div className="request-header">
                            <span className="blood-type-badge">{request.bloodGroup}</span>
                            <span className="status-badge approved">Approved</span>
                          </div>
                          <div className="request-details">
                            <p><strong>Patient:</strong> {request.patientName}</p>
                            <p><strong>Hospital:</strong> {request.hospital?.name || 'N/A'}</p>
                            <p><strong>Address:</strong> {request.hospital?.address || 'N/A'}</p>
                            <p><strong>Blood Group:</strong> {request.bloodGroup}</p>
                            <p><strong>Units Provided:</strong> {request.units}</p>
                            <p><strong>Contact:</strong> {request.contactNumber}</p>
                            <p><strong>Required By:</strong> {new Date(request.requiredBy).toLocaleDateString()}</p>
                            {request.requestedBy && (
                              <>
                                <p><strong>Requested By:</strong> {request.requestedBy.name}</p>
                                <p><strong>Email:</strong> {request.requestedBy.email}</p>
                                <p><strong>Phone:</strong> {request.requestedBy.phone}</p>
                              </>
                            )}
                            {request.description && (
                              <p><strong>Description:</strong> {request.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Blood Banks Tab */}
          {activeTab === 'bloodbanks' && (
            <div className="bloodbanks-content">
              <h2>Blood Banks Directory</h2>
              <p className="section-description">Browse available blood banks and check their inventory status</p>
              
              {loadingBloodBanks ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading blood banks...</p>
                </div>
              ) : bloodBanksList.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <h3>No Blood Banks Found</h3>
                  <p>Blood banks registered in the system will appear here</p>
                </div>
              ) : (
                <div className="bloodbanks-grid">
                  {/* Real blood banks data from API */}
                  {bloodBanksList.map((bloodBankItem, index) => (
                    <div key={bloodBankItem.id || index} className="bloodbank-item">
                      <div className="bloodbank-header">
                        <div className="bloodbank-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                        </div>
                        <div>
                          <h3>{bloodBankItem.name}</h3>
                          <p className="bloodbank-address">{bloodBankItem.address}, {bloodBankItem.city}</p>
                        </div>
                      </div>
                      <div className="bloodbank-quick-info">
                        <div className="info-item">
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C7.82 21 2 15.18 2 8V5z" strokeWidth="2"/>
                          </svg>
                          {bloodBankItem.phone}
                        </div>
                        <div className="info-item">
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <circle cx="10" cy="10" r="7" strokeWidth="2"/>
                            <path d="M10 6v4l2 2" strokeWidth="2"/>
                          </svg>
                          {bloodBankItem.operatingHours || 'Contact for hours'}
                        </div>
                      </div>
                      <button 
                        className="btn-view-details"
                        onClick={() => {
                          setSelectedBloodBank(bloodBankItem);
                          setShowBloodBankDetails(true);
                        }}
                      >
                        View Details & Inventory
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="settings-content">
              <h2>Hospital Settings</h2>
              
              {/* Hospital Photo Upload Section */}
              <div className="settings-section">
                <h3>Hospital Photo</h3>
                <div className="settings-form">
                  <div className="photo-upload-container">
                    <div className="photo-preview-wrapper">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Hospital" className="hospital-photo-preview" />
                      ) : (
                        <div className="no-photo-placeholder">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                          <p>No photo uploaded</p>
                        </div>
                      )}
                    </div>
                    <div className="photo-upload-actions">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        style={{ display: 'none' }}
                        id="bloodBankPhotoInput"
                      />
                      <label htmlFor="bloodBankPhotoInput" className="btn-upload-photo">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" strokeWidth="2"/>
                          <polyline points="13 2 13 9 20 9" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Choose Photo
                      </label>
                      {photoPreview && (
                        <button 
                          onClick={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="btn-save-photo"
                        >
                          {uploadingPhoto ? (
                            <>
                              <span className="spinner-small"></span>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                                <path d="M16 4L6 14L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Save Photo
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="photo-help-text">Recommended: 800x600px, Max size: 5MB</p>
                  </div>
                </div>
              </div>

              {/* Hospital Location Section */}
              <div className="settings-section">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                    <path d="M12 2C9.5 2 7 4 7 7C7 11 12 18 12 18C12 18 17 11 17 7C17 4 14.5 2 12 2Z"/>
                    <circle cx="12" cy="7" r="2"/>
                  </svg>
                  Hospital Location
                </h3>
                <div className="settings-form">
                  {bankLocation?.coordinates && 
                   (bankLocation.coordinates[0] !== 0 || bankLocation.coordinates[1] !== 0) ? (
                    <div className="location-info-display">
                      <div className="location-status location-saved">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>Location saved</span>
                      </div>
                      <p className="coordinates-display">
                        <strong>Coordinates:</strong> {bankLocation.coordinates[1].toFixed(6)}, {bankLocation.coordinates[0].toFixed(6)}
                      </p>
                      <div className="location-actions">
                        <button 
                          type="button"
                          className="btn-view-location"
                          onClick={() => setShowBankMapModal(true)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          View on Map
                        </button>
                        <button 
                          type="button"
                          className="btn-update-location"
                          onClick={handleGetBankLocation}
                          disabled={gettingBankLocation}
                        >
                          {gettingBankLocation ? (
                            <>
                              <span className="spinner-small"></span>
                              Updating...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              Update Location
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-location-display">
                      <div className="no-location-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2C9.5 2 7 4 7 7C7 11 12 18 12 18C12 18 17 11 17 7C17 4 14.5 2 12 2Z"/>
                          <circle cx="12" cy="7" r="2"/>
                          <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <p>No location set. Share your hospital location so patients can find you easily.</p>
                      <button 
                        type="button"
                        className="btn-capture-location"
                        onClick={handleGetBankLocation}
                        disabled={gettingBankLocation}
                      >
                        {gettingBankLocation ? (
                          <>
                            <span className="spinner-small"></span>
                            Getting Location...
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            Capture Current Location
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-section">
                <h3>Hospital Profile</h3>
                <div className="settings-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Hospital Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={bloodBank?.name || ''}
                        placeholder="Enter hospital name"
                        readOnly
                      />
                    </div>
                    <div className="form-group">
                      <label>Registration Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={bloodBank?.registrationNumber || ''}
                        placeholder="Hospital registration number"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={bloodBank?.email || ''}
                        placeholder="Hospital email"
                        readOnly
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={bloodBank?.phone || ''}
                        placeholder="Contact number"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={bloodBank?.address || ''}
                      placeholder="Hospital address"
                      readOnly
                    />
                  </div>

                  <button className="btn-save-settings">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M16 4L6 14L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Save Profile
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Operating Hours</h3>
                <div className="settings-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Opening Time</label>
                      <input
                        type="time"
                        className="form-control"
                        defaultValue="09:00"
                      />
                    </div>
                    <div className="form-group">
                      <label>Closing Time</label>
                      <input
                        type="time"
                        className="form-control"
                        defaultValue="17:00"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>Open on Weekends</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>24/7 Emergency Service</span>
                    </label>
                  </div>

                  <button className="btn-save-settings">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M16 4L6 14L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Save Hours
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Notification Preferences</h3>
                <div className="settings-form">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>Email notifications for new blood requests</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>SMS alerts for critical blood shortages</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked />
                      <span>Weekly inventory reports</span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" />
                      <span>Donor registration notifications</span>
                    </label>
                  </div>

                  <button className="btn-save-settings">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M16 4L6 14L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Save Preferences
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Security</h3>
                <div className="settings-form">
                  <div className="form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button className="btn-save-settings btn-danger">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Change Password
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Data Management</h3>
                <div className="settings-form">
                  <p className="settings-description">
                    Export your hospital data and reports for backup or analysis.
                  </p>
                  
                  <div className="data-export-options">
                    <button className="btn-export">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M17 13v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2M15 8l-5-5m0 0L5 8m5-5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Export Inventory Data
                    </button>
                    <button className="btn-export">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M17 13v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2M15 8l-5-5m0 0L5 8m5-5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Export Camp Reports
                    </button>
                    <button className="btn-export">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M17 13v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2M15 8l-5-5m0 0L5 8m5-5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Export All Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Camp Modal */}
      {showCampModal && (
        <div className="modal-overlay" onClick={() => setShowCampModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Blood Camp</h2>
              <button className="modal-close" onClick={() => setShowCampModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateCamp} className="camp-form">
              <div className="form-group">
                <label>Camp Name</label>
                <input
                  type="text"
                  name="name"
                  value={campForm.name}
                  onChange={handleCampFormChange}
                  placeholder="Enter camp name"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={campForm.date}
                    onChange={handleCampFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Target Units</label>
                  <input
                    type="number"
                    name="targetUnits"
                    value={campForm.targetUnits}
                    onChange={handleCampFormChange}
                    min="10"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    value={campForm.startTime}
                    onChange={handleCampFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    name="endTime"
                    value={campForm.endTime}
                    onChange={handleCampFormChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Venue</label>
                <input
                  type="text"
                  name="venue"
                  value={campForm.venue}
                  onChange={handleCampFormChange}
                  placeholder="Venue name"
                  required
                />
              </div>

              <div className="form-group location-group">
                <label>Location</label>
                <button 
                  type="button" 
                  className="fetch-location-btn"
                  onClick={fetchLocation}
                  disabled={fetchingLocation}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="10" r="3"/>
                    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 7 8 11.7z"/>
                  </svg>
                  {fetchingLocation ? 'Fetching Location...' : 'Auto-Fetch Location'}
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    name="address"
                    value={campForm.address}
                    onChange={handleCampFormChange}
                    placeholder="Street address"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    name="city"
                    value={campForm.city}
                    onChange={handleCampFormChange}
                    placeholder="City"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    name="state"
                    value={campForm.state}
                    onChange={handleCampFormChange}
                    placeholder="State"
                  />
                </div>
                <div className="form-group">
                  <label>Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={campForm.pincode}
                    onChange={handleCampFormChange}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={campForm.description}
                  onChange={handleCampFormChange}
                  placeholder="Camp description..."
                  rows="3"
                ></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCampModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create Camp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camp Details Modal */}
      {showCampDetails && selectedCamp && (
        <div className="modal-overlay" onClick={() => setShowCampDetails(false)}>
          <div className="modal-content camp-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedCamp.name}</h2>
              <button className="close-modal" onClick={() => setShowCampDetails(false)}>×</button>
            </div>
            <div className="camp-details-content">
              <div className="detail-section">
                <h3>Event Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span>{new Date(selectedCamp.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Time:</span>
                  <span>{selectedCamp.startTime} - {selectedCamp.endTime}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`camp-status ${selectedCamp.status}`}>{selectedCamp.status}</span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Location</h3>
                <div className="detail-row">
                  <span className="detail-label">Venue:</span>
                  <span>{selectedCamp.venue}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span>{selectedCamp.address}, {selectedCamp.city}</span>
                </div>
                {selectedCamp.state && (
                  <div className="detail-row">
                    <span className="detail-label">State:</span>
                    <span>{selectedCamp.state}</span>
                  </div>
                )}
                {selectedCamp.pincode && (
                  <div className="detail-row">
                    <span className="detail-label">Pincode:</span>
                    <span>{selectedCamp.pincode}</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Collection Progress</h3>
                <div className="detail-row">
                  <span className="detail-label">Target Units:</span>
                  <span>{selectedCamp.targetUnits} units</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Collected:</span>
                  <span>{selectedCamp.collectedUnits} units</span>
                </div>
                <div className="progress-bar-large">
                  <div 
                    className="progress-fill-large"
                    style={{ width: `${(selectedCamp.collectedUnits / selectedCamp.targetUnits) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-percentage">
                  {Math.round((selectedCamp.collectedUnits / selectedCamp.targetUnits) * 100)}% Complete
                </div>
              </div>

              {selectedCamp.description && (
                <div className="detail-section">
                  <h3>Description</h3>
                  <p>{selectedCamp.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registrations Modal */}
      {showRegistrations && selectedCamp && (
        <div className="modal-overlay" onClick={() => setShowRegistrations(false)}>
          <div className="modal-content registrations-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrations - {selectedCamp.name}</h2>
              <button className="close-modal" onClick={() => setShowRegistrations(false)}>×</button>
            </div>
            <div className="registrations-content">
              {selectedCamp.registeredDonors && selectedCamp.registeredDonors.length > 0 ? (
                <div className="registrations-table-container">
                  <table className="registrations-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Name</th>
                        <th>Blood Group</th>
                        <th>Phone</th>
                        <th>Registered At</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCamp.registeredDonors.map((donor, index) => {
                        // Check if event has passed
                        const eventDate = new Date(selectedCamp.date);
                        const today = new Date();
                        const isPastEvent = eventDate < today.setHours(0, 0, 0, 0);
                        
                        return (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{donor.name}</td>
                            <td>
                              <span className="blood-type-badge">{donor.bloodGroup}</span>
                            </td>
                            <td>{donor.phone}</td>
                            <td>{new Date(donor.registeredAt).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-badge ${isPastEvent ? (donor.attended ? 'attended' : 'pending') : 'registered'}`}>
                                {isPastEvent ? (donor.attended ? 'ATTENDED' : 'PENDING') : 'REGISTERED'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="delete-donor-btn"
                                onClick={() => handleDeleteDonor(selectedCamp._id, donor._id || donor.donor)}
                                title="Remove registration"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#e63946',
                                  cursor: 'pointer',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'color 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#c41e3a'}
                                onMouseLeave={(e) => e.currentTarget.style.color = '#e63946'}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                  <line x1="10" y1="11" x2="10" y2="17"/>
                                  <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="registrations-summary">
                    {(() => {
                      const eventDate = new Date(selectedCamp.date);
                      const today = new Date();
                      const isPastEvent = eventDate < today.setHours(0, 0, 0, 0);
                      
                      if (isPastEvent) {
                        return (
                          <>
                            <p><strong>Total Registrations:</strong> {selectedCamp.registeredDonors.length}</p>
                            <p><strong>Attended:</strong> {selectedCamp.registeredDonors.filter(d => d.attended).length}</p>
                            <p><strong>Pending:</strong> {selectedCamp.registeredDonors.filter(d => !d.attended).length}</p>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <p><strong>Total Registrations:</strong> {selectedCamp.registeredDonors.length}</p>
                            <p><strong>Registered:</strong> {selectedCamp.registeredDonors.length}</p>
                          </>
                        );
                      }
                    })()}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  <h3>No Registrations Yet</h3>
                  <p>No donors have registered for this camp yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blood Bank Details Modal */}
      {showBloodBankDetails && selectedBloodBank && (
        <div className="modal-overlay" onClick={() => setShowBloodBankDetails(false)}>
          <div className="modal-content bloodbank-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedBloodBank.name}</h2>
              <button className="close-modal" onClick={() => setShowBloodBankDetails(false)}>×</button>
            </div>
            <div className="bloodbank-details-content">
              <div className="detail-section">
                <h3>Contact Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Phone:</span>
                  <span>{selectedBloodBank.phone}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span>{selectedBloodBank.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Operating Hours:</span>
                  <span>{selectedBloodBank.operatingHours}</span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Location</h3>
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span>{selectedBloodBank.address}, {selectedBloodBank.city}</span>
                </div>
                {selectedBloodBank.location && (
                  <div className="detail-row">
                    <span className="detail-label">Coordinates:</span>
                    <span>Lat: {selectedBloodBank.location.lat}, Lng: {selectedBloodBank.location.lng}</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Blood Inventory</h3>
                <div className="inventory-grid-modal">
                  {selectedBloodBank.inventory.map((item) => {
                    const getStatus = (units) => {
                      if (units === 0) return 'critical';
                      if (units < 20) return 'low';
                      if (units < 40) return 'moderate';
                      return 'good';
                    };

                    const status = getStatus(item.units);

                    return (
                      <div key={item.type} className={`inventory-item-modal ${status}`}>
                        <div className="blood-type">{item.type}</div>
                        <div className="units-count">{item.units}</div>
                        <div className="units-label">Units</div>
                        <div className={`status-indicator ${status}`}>
                          {status === 'critical' && 'Critical'}
                          {status === 'low' && 'Low'}
                          {status === 'moderate' && 'Moderate'}
                          {status === 'good' && 'Good'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="total-inventory">
                  <strong>Total Available:</strong> {selectedBloodBank.inventory.reduce((sum, item) => sum + item.units, 0)} units
                </div>
              </div>

              <div className="modal-actions">
                <Link to="/create-request" className="btn-request-blood">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Request for Blood
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal for Blood Bank Location */}
      {showBankMapModal && bankLocation && (
        <MapModal
          location={bankLocation}
          name={bloodBank?.name || 'Hospital Location'}
          onClose={() => setShowBankMapModal(false)}
        />
      )}
    </div>
  );
};

export default BloodBankDashboard;

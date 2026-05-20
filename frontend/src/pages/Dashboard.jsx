import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContainer';
import './Dashboard.css';

const Dashboard = () => {
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dashboardStats, setDashboardStats] = useState(null);
  const [donorStats, setDonorStats] = useState({
    totalDonations: 0,
    eventsAttended: 0,
    bloodDonated: 0,
    lastDonation: null,
    upcomingEvents: 0
  });
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [donorRegistration, setDonorRegistration] = useState({
    registerAsDonor: false,
    availableForDonation: false
  });
  const { user, setUser } = useAuth();
  const toast = useToast();

  useEffect(() => {
    fetchData();
    fetchDashboardStats();
    if (user?.activeMode === 'donor' && user?.isDonor) {
      fetchDonorStats();
    }
    
    // Check for incomplete profile
    checkProfileCompletion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activeMode]);

  const checkProfileCompletion = () => {
    if (!user) return;
    
    const missingFields = [];
    
    if (!user.phone || user.phone.trim() === '') missingFields.push('Phone Number');
    if (!user.bloodGroup || user.bloodGroup === '') missingFields.push('Blood Group');
    if (!user.address?.city || user.address?.city.trim() === '' || !user.address?.state || user.address?.state.trim() === '') missingFields.push('Address');
    
    if (missingFields.length > 0) {
      setMessage({
        type: 'warning',
        text: `Please complete your profile! Missing: ${missingFields.join(', ')}. Go to Profile to update.`
      });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allRequestsRes, myRequestsRes] = await Promise.all([
        requestAPI.getAll({ status: 'pending' }),
        requestAPI.getMyRequests(),
      ]);
      
      setRequests(allRequestsRes.data);
      setMyRequests(myRequestsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await userAPI.getDashboardStats();
      setDashboardStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchDonorStats = async () => {
    try {
      // Fetch real stats from dashboard stats API
      const response = await userAPI.getDashboardStats();
      const registeredEvents = response.data.stats?.overview?.registeredEvents || 0;
      
      setDonorStats({
        totalDonations: 0,
        eventsAttended: registeredEvents, // Show registered events count
        bloodDonated: 0, // in ml
        lastDonation: user?.lastDonationDate || null,
        upcomingEvents: registeredEvents
      });
    } catch (error) {
      console.error('Error fetching donor stats:', error);
      // Default to 0 for new donors on error
      setDonorStats({
        totalDonations: 0,
        eventsAttended: 0,
        bloodDonated: 0,
        lastDonation: user?.lastDonationDate || null,
        upcomingEvents: 0
      });
    }
  };

  const handleModeToggle = async () => {
    if (!user) {
      setMessage({ 
        type: 'error', 
        text: 'Please log in to switch modes' 
      });
      return;
    }

    // Default to patient if activeMode not set
    const currentMode = user.activeMode || 'patient';
    const newMode = currentMode === 'donor' ? 'patient' : 'donor';
    
    // If switching to donor and not registered yet, show modal
    if (newMode === 'donor' && !user.isDonor) {
      setShowDonorModal(true);
      return;
    }
    
    try {
      setLoading(true);
      const response = await userAPI.toggleMode(newMode);
      
      if (response.data.requiresRegistration) {
        setShowDonorModal(true);
        setLoading(false);
        return;
      }

      // Update user in context and local state
      const updatedUser = { ...user, activeMode: response.data.user.activeMode };
      setUser(updatedUser);
      
      setMessage({ 
        type: 'success', 
        text: `Successfully switched to ${newMode} mode!` 
      });
      
      // Refresh data after mode change
      await fetchData();
      await fetchDashboardStats();
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error toggling mode:', error);
      
      let errorMessage = 'Failed to switch mode. Please try again.';
      
      if (error.response) {
        // Server responded with an error
        errorMessage = error.response.data?.message || errorMessage;
        
        if (error.response.status === 401) {
          errorMessage = 'Session expired. Please log in again.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Cannot connect to server. Please check your connection.';
      }
      
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDonorRegistration = async () => {
    if (!donorRegistration.registerAsDonor) {
      setMessage({
        type: 'error',
        text: 'You must agree to register as a blood donor'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Update user profile with donor registration
      await userAPI.updateProfile({
        isDonor: true,
        isAvailable: donorRegistration.availableForDonation
      });

      // Switch to donor mode
      await userAPI.toggleMode('donor');
      
      // Update user in context
      const updatedUser = { 
        ...user, 
        isDonor: true,
        isAvailable: donorRegistration.availableForDonation,
        activeMode: 'donor'
      };
      setUser(updatedUser);
      
      setShowDonorModal(false);
      setMessage({ 
        type: 'success', 
        text: 'Successfully registered as a donor and switched to donor mode!' 
      });
      toast.success('Successfully registered as a donor! Welcome to our lifesaving community.');
      
      // Refresh data
      await fetchData();
      await fetchDashboardStats();
      
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error registering as donor:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to register as donor'
      });
      toast.error(error.response?.data?.message || 'Failed to register as donor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    try {
      console.log('Cancelling request:', requestId);
      const response = await requestAPI.updateStatus(requestId, 'cancelled');
      console.log('Cancel response:', response.data);
      setMessage({ type: 'success', text: 'Request cancelled successfully!' });
      toast.success('Blood request cancelled successfully.');
      fetchData(); // Refresh the data
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Cancel request error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to cancel request';
      setMessage({ type: 'error', text: errorMessage });
      toast.error(errorMessage);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const getUrgencyClass = (urgency) => {
    return `status-badge status-${urgency}`;
  };

  const renderRequests = (requestList, isMyRequests = false) => {
    if (requestList.length === 0) {
      return (
        <div className="empty-state">
          <p>No blood requests found.</p>
        </div>
      );
    }

    return requestList.map((request) => (
      <div key={request._id} className="request-card">
        <div className="request-header">
          <h3>{request.patientName}</h3>
          <span className={getUrgencyClass(request.urgency)}>
            {request.urgency.toUpperCase()}
          </span>
        </div>
        <div className="request-body">
          <div className="request-info">
            <span className="blood-group-badge">{request.bloodGroup}</span>
            <span>{request.units} unit{request.units > 1 ? 's' : ''} needed</span>
          </div>
          <div className="request-details">
            <p><strong>Hospital:</strong> {request.hospital?.name || 'Not specified'}</p>
            <p><strong>Contact:</strong> {request.contactNumber}</p>
            <p><strong>Required By:</strong> {new Date(request.requiredBy).toLocaleDateString()}</p>
            {request.description && (
              <p><strong>Note:</strong> {request.description}</p>
            )}
          </div>
          {isMyRequests && request.status === 'pending' && (
            <div className="request-actions">
              <button 
                className="btn-cancel-request"
                onClick={() => handleCancelRequest(request._id)}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Cancel Request
              </button>
            </div>
          )}
        </div>
      </div>
    ));
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>{(user?.activeMode === 'donor' && user?.isDonor) ? 'Donor Dashboard' : 'Dashboard'}</h1>
          {user && (
            <div className="mode-display">
              <span className={`mode-badge mode-${user.activeMode || 'patient'}`}>
                {(user.activeMode || 'patient') === 'donor' ? '🩸 Donor Mode' : '🏥 Patient Mode'}
              </span>
            </div>
          )}
        </div>
        <div className="header-actions">
          {user && (
            <button 
              onClick={handleModeToggle}
              className="btn-mode-toggle"
              title={`Switch to ${(user.activeMode || 'patient') === 'donor' ? 'Patient' : 'Donor'} Mode`}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M17 8L12 3M12 3L7 8M12 3V13M3 12L8 17M8 17L13 12M8 17V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Switch to {(user.activeMode || 'patient') === 'donor' ? 'Patient' : 'Donor'}
            </button>
          )}
          {(user?.activeMode || 'patient') !== 'donor' && (
            <Link to="/create-request" className="btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Create Blood Request
            </Link>
          )}
          {(user?.activeMode || 'patient') === 'donor' && !user?.isDonor && (
            <Link to="/donor-form" className="btn btn-donor">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C10 2 5 7.5 5 12C5 14.7614 7.23858 17 10 17C12.7614 17 15 14.7614 15 12C15 7.5 10 2 10 2Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2"/>
              </svg>
              Complete Donor Registration
            </Link>
          )}
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Donor Mode Stats */}
      {user?.activeMode === 'donor' && user?.isDonor ? (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-donations">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C10 2 5 7.5 5 12C5 14.7614 7.23858 17 10 17C12.7614 17 15 14.7614 15 12C15 7.5 10 2 10 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="#ef4444"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>{donorStats.totalDonations}</h3>
              <p>Total Donations</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-events">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 2V6M8 2V6M3 10H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>{donorStats.eventsAttended}</h3>
              <p>Events Attended</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-blood">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <path d="M2 10h4l3-6 4 12 3-6h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>{(donorStats.bloodDonated / 1000).toFixed(1)}L</h3>
              <p>Blood Donated</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-upcoming">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 5V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>{donorStats.upcomingEvents}</h3>
              <p>Upcoming Events</p>
            </div>
          </div>
        </div>
      ) : (
        // Patient Mode Stats
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-requests">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C10 2 5 7.5 5 12C5 14.7614 7.23858 17 10 17C12.7614 17 15 14.7614 15 12C15 7.5 10 2 10 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="#ef4444"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{requests.length}</h3>
            <p>Active Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-my">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
              <rect x="6" y="2" width="8" height="14" rx="1" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 2H8C8 0.895 8.895 0 10 0C11.105 0 12 0.895 12 2H12" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 8H12M8 11H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{myRequests.length}</h3>
            <p>My Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-donors">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
              <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="2"/>
              <circle cx="13" cy="5" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M1 17C1 13.686 3.686 11 7 11C10.314 11 13 13.686 13 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 17C7 13.686 9.686 11 13 11C16.314 11 19 13.686 19 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{dashboardStats?.overview?.totalDonors || 0}</h3>
            <p>Available Donors</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-events">
            <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="4" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 8H17M7 2V6M13 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{dashboardStats?.overview?.upcomingEvents || 0}</h3>
            <p>Upcoming Events</p>
          </div>
        </div>
      </div>
      )}

      {/* Donor Mode: Show Donation History & Upcoming Events */}
      {user?.activeMode === 'donor' && user?.isDonor ? (
        <div className="donor-dashboard-content">
          <div className="donor-info-card">
            <h2>Your Donor Journey</h2>
            <div className="donor-journey-stats">
              {donorStats.lastDonation && (
                <div className="journey-item">
                  <span className="journey-label">Last Donation</span>
                  <span className="journey-value">{new Date(donorStats.lastDonation).toLocaleDateString()}</span>
                </div>
              )}
              {!donorStats.lastDonation && donorStats.totalDonations === 0 && (
                <div className="journey-item">
                  <span className="journey-label">Last Donation</span>
                  <span className="journey-value">No donations yet</span>
                </div>
              )}
              <div className="journey-item">
                <span className="journey-label">Lives Impacted</span>
                <span className="journey-value">{donorStats.totalDonations * 3} {donorStats.totalDonations === 0 ? 'People (Start your journey!)' : 'People'}</span>
              </div>
            </div>
          </div>

          <div className="activity-section">
            <h2>Recent Donation Activity</h2>
            {donorStats.totalDonations === 0 && donorStats.eventsAttended === 0 ? (
              <div className="empty-state">
                <h3>Welcome to Your Donor Journey! 🩸</h3>
                <p>You haven't made any donations or attended events yet. Start your life-saving journey by attending blood donation events!</p>
                <Link to="/events" className="btn btn-primary">Browse Events</Link>
              </div>
            ) : (
              <p>You have participated in {donorStats.eventsAttended} donation event{donorStats.eventsAttended !== 1 ? 's' : ''} and made {donorStats.totalDonations} donation{donorStats.totalDonations !== 1 ? 's' : ''}.</p>
            )}
          </div>
        </div>
      ) : (
        // Patient Mode: Show Charts Section
        <>
      {dashboardStats && (
        <div className="charts-section">
          <div className="chart-card">
            <h3>Blood Group Distribution (Active Requests)</h3>
            <div className="bar-chart">
              {dashboardStats.bloodGroups && dashboardStats.bloodGroups.length > 0 ? (
                dashboardStats.bloodGroups.map((item, index) => {
                  const maxCount = Math.max(...dashboardStats.bloodGroups.map(i => i.count));
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={index} className="bar-item">
                      <div className="bar-label">{item._id}</div>
                      <div className="bar-container">
                        <div 
                          className="bar-fill" 
                          style={{ width: `${percentage}%` }}
                          title={`${item.count} requests`}
                        >
                          <span className="bar-count">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="chart-empty">No data available</p>
              )}
            </div>
          </div>

          <div className="chart-card">
            <h3>Request Urgency Levels</h3>
            <div className="urgency-chart">
              {dashboardStats.urgency && dashboardStats.urgency.length > 0 ? (
                <div className="urgency-grid">
                  {dashboardStats.urgency.map((item, index) => (
                    <div key={index} className={`urgency-item urgency-${item._id}`}>
                      <div className="urgency-count">{item.count}</div>
                      <div className="urgency-label">{item._id}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="chart-empty">No data available</p>
              )}
            </div>
          </div>

          <div className="chart-card chart-wide">
            <h3>Request Trend (Last 6 Months)</h3>
            <div className="line-chart">
              {dashboardStats.monthlyTrend && dashboardStats.monthlyTrend.length > 0 ? (
                <div className="trend-chart">
                  {dashboardStats.monthlyTrend.map((item, index) => {
                    const maxCount = Math.max(...dashboardStats.monthlyTrend.map(i => i.count));
                    const height = (item.count / maxCount) * 100;
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return (
                      <div key={index} className="trend-item">
                        <div className="trend-bar-container">
                          <div 
                            className="trend-bar" 
                            style={{ height: `${height}%` }}
                            title={`${item.count} requests`}
                          >
                            <span className="trend-count">{item.count}</span>
                          </div>
                        </div>
                        <div className="trend-label">
                          {monthNames[item._id.month - 1]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="chart-empty">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Requests ({requests.length})
          </button>
          <button
            className={`tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            My Requests ({myRequests.length})
          </button>
        </div>

        <div className="requests-container">
          {activeTab === 'all' ? renderRequests(requests, false) : renderRequests(myRequests, true)}
        </div>
      </div>
      </>
      )}

      {/* Donor Registration Modal */}
      {showDonorModal && (
        <div className="modal-overlay" onClick={() => setShowDonorModal(false)}>
          <div className="modal-content donor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Donor Registration</h2>
              <button className="close-modal" onClick={() => setShowDonorModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                To switch to donor mode, please confirm your registration as a blood donor.
              </p>
              
              <div className="checkbox-group">
                <label className="checkbox-label required">
                  <input
                    type="checkbox"
                    checked={donorRegistration.registerAsDonor}
                    onChange={(e) => setDonorRegistration({
                      ...donorRegistration,
                      registerAsDonor: e.target.checked
                    })}
                  />
                  <span className="checkbox-text">
                    <strong>Register as a blood donor</strong>
                    <small>I agree to register as a voluntary blood donor</small>
                  </span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={donorRegistration.availableForDonation}
                    onChange={(e) => setDonorRegistration({
                      ...donorRegistration,
                      availableForDonation: e.target.checked
                    })}
                  />
                  <span className="checkbox-text">
                    <strong>Available for donation</strong>
                    <small>I am currently available to donate blood</small>
                  </span>
                </label>
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-cancel" 
                  onClick={() => setShowDonorModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-submit" 
                  onClick={handleDonorRegistration}
                  disabled={loading || !donorRegistration.registerAsDonor}
                >
                  {loading ? 'Processing...' : 'Confirm & Switch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

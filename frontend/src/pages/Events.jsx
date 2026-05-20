import React, { useState, useEffect } from 'react';
import { eventAPI, bloodCampAPI } from '../services/api';

import './Events.css';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [bloodCamps, setBloodCamps] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Get current user ID from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUserId(user.id || user._id);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch blood camps from BloodCamp collection
      const campsResponse = await bloodCampAPI.getAll({ upcoming: true });
      const camps = campsResponse.data || [];
      console.log('Fetched blood camps:', camps);
      setBloodCamps(camps);
      
      // Fetch all events (awareness events, etc.)
      const eventsResponse = await eventAPI.getAll();
      const allEvents = eventsResponse.data || [];
      
      // Filter out donation-camp events (we're getting camps from BloodCamp collection now)
      const regularEvents = allEvents.filter(event => event.eventType !== 'donation-camp');
      console.log('Fetched events:', regularEvents);
      setEvents(regularEvents);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Use empty arrays on error
      setEvents([]);
      setBloodCamps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (eventId) => {
    try {
      await eventAPI.register(eventId);
      setMessage('Successfully registered for the event!');
      fetchAllData(); // Refresh data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Registration failed');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const isRegisteredForCamp = (camp) => {
    if (!currentUserId || !camp.registeredDonors) return false;
    return camp.registeredDonors.some(
      donor => donor.donor === currentUserId || donor.donor?._id === currentUserId
    );
  };

  const handleCampRegister = async (campId) => {
    try {
      console.log('Registering for blood camp:', campId);
      // Register for blood camp using bloodCampAPI
      await bloodCampAPI.register(campId, {});
      setMessage('Successfully registered for the blood camp!');
      fetchAllData(); // Refresh data
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Registration error:', error);
      setMessage(error.response?.data?.message || 'Registration failed. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getFilteredContent = () => {
    if (activeTab === 'events') return { events, camps: [] };
    if (activeTab === 'camps') return { events: [], camps: bloodCamps };
    return { events, camps: bloodCamps };
  };

  const { events: filteredEvents, camps: filteredCamps } = getFilteredContent();

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Blood Donation Events & Camps</h1>
        <p className="page-subtitle">Find blood donation events and camps near you</p>
      </div>

      {/* Tab Navigation */}
      <div className="events-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          All
        </button>
        <button 
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Events
        </button>
        <button 
          className={`tab-btn ${activeTab === 'camps' ? 'active' : ''}`}
          onClick={() => setActiveTab('camps')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Blood Camps
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Success') ? 'success-message' : 'error-message'}`}>
          {message}
        </div>
      )}

      {/* Blood Camps Section */}
      {filteredCamps.length > 0 && (
        <div className="camps-section">
          <h2 className="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Blood Donation Camps
          </h2>
          <div className="camps-grid">
            {filteredCamps.map((camp) => (
              <div key={camp._id} className="camp-card">
                <div className="camp-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  Blood Camp
                </div>
                <h3>{camp.name}</h3>
                <p className="camp-description">{camp.description}</p>
                
                <div className="camp-info-grid">
                  <div className="camp-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>{new Date(camp.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="camp-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{camp.startTime} - {camp.endTime}</span>
                  </div>
                  <div className="camp-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{camp.venue}, {camp.city}</span>
                  </div>
                  <div className="camp-info-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>{camp.organizerName || camp.organizer?.name || 'Blood Bank'}</span>
                  </div>
                </div>
                
                <div className="camp-target">
                  <span>Target: {camp.targetUnits} units</span>
                  <span className={`camp-status ${camp.status}`}>{camp.status}</span>
                </div>
                
                <button
                  onClick={() => handleCampRegister(camp._id)}
                  className={`btn btn-block ${
                    isRegisteredForCamp(camp) ? 'btn-success' : 'btn-primary'
                  }`}
                  disabled={isRegisteredForCamp(camp)}
                  style={{
                    cursor: isRegisteredForCamp(camp) ? 'not-allowed' : 'pointer',
                    opacity: isRegisteredForCamp(camp) ? 0.7 : 1
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isRegisteredForCamp(camp) ? (
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    ) : (
                      <>
                        <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                      </>
                    )}
                  </svg>
                  {isRegisteredForCamp(camp) ? 'Already Registered' : 'Register for Camp'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular Events Section */}
      {filteredEvents.length > 0 && (
        <div className="events-section">
          <h2 className="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Upcoming Events
          </h2>
          <div className="events-grid">
            {filteredEvents.map((event) => (
            <div key={event._id} className="event-card">
              <div className="event-type">
                {event.eventType === 'blood-drive' && (
                  <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2C10 2 5 7.5 5 12C5 14.7614 7.23858 17 10 17C12.7614 17 15 14.7614 15 12C15 7.5 10 2 10 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="#ef4444"/>
                  </svg>
                )}
                {event.eventType === 'awareness' && (
                  <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                    <path d="M8 3H5C3.9 3 3 3.9 3 5V16C3 17.1 3.9 18 5 18H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 10H18L15 7M18 10L15 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {event.eventType === 'donation-camp' && (
                  <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
                    <path d="M3 18L10 4L17 18H3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M10 4L10 12" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </div>
              
              <h2>{event.title}</h2>
              <p className="event-description">{event.description}</p>
              
              <div className="event-details">
                <div className="detail-row">
                  <span className="detail-label">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
                      <rect x="3" y="4" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 2V6M13 2V6M3 8H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Date:
                  </span>
                  <span>{new Date(event.date).toLocaleDateString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2"/>
                      <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Time:
                  </span>
                  <span>{event.startTime} - {event.endTime}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
                      <rect x="3" y="3" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 7H9M7 11H9M11 7H13M11 11H13M6 19H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Organizer:
                  </span>
                  <span>{event.organizer}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
                      <path d="M10 2C7.5 2 5 4 5 7C5 11 10 18 10 18C10 18 15 11 15 7C15 4 12.5 2 10 2Z" stroke="currentColor" strokeWidth="2"/>
                      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    Location:
                  </span>
                  <span>{event.location?.name || 'TBD'}</span>
                </div>
                {event.location?.address && (
                  <div className="detail-row">
                    <span className="detail-label">Address:</span>
                    <span>{event.location.address}</span>
                  </div>
                )}
                {event.contactInfo && (
                  <>
                    {event.contactInfo.phone && (
                      <div className="detail-row">
                        <span className="detail-label">📞 Contact:</span>
                        <span>{event.contactInfo.phone}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="detail-row">
                  <span className="detail-label">👥 Registered:</span>
                  <span>{event.registeredDonors?.length || 0} donors</span>
                </div>
              </div>
              
              <button
                onClick={() => handleRegister(event._id)}
                className="btn btn-primary btn-block"
              >
                Register for Event
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredEvents.length === 0 && filteredCamps.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No upcoming events or camps at the moment.</p>
          <p className="empty-subtitle">Check back soon for new blood donation opportunities!</p>
        </div>
      )}
    </div>
  );
};

export default Events;

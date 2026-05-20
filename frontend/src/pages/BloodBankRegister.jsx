import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../components/ToastContainer';
import './BloodBankAuth.css';

const BloodBankRegister = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState(null);
  const [locationShared, setLocationShared] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    logo: '',
    
    // License & Registration
    licenseNumber: '',
    registrationNumber: '',
    establishedYear: '',
    
    // Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    
    // Operating Hours
    openTime: '09:00',
    closeTime: '18:00',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    
    // Services
    services: [],
    
    // Contact Person
    contactPersonName: '',
    contactPersonPhone: '',
    contactPersonEmail: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allServices = [
    'Whole Blood',
    'Plasma',
    'Platelets',
    'Red Blood Cells',
    'Blood Testing',
    'Blood Camp Organization',
    'Emergency Services',
    '24/7 Availability'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day]
    }));
  };

  const handleServiceToggle = (service) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.phone) {
          setError('Please fill in all required fields');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          toast.error('Password must be at least 6 characters');
          return false;
        }
        break;
      case 2:
        if (!formData.licenseNumber || !formData.address || !formData.city || !formData.state || !formData.pincode) {
          setError('Please fill in all required fields');
          toast.error('Please fill in all required fields');
          return false;
        }
        if (!locationShared) {
          setError('Please share your location');
          toast.warning('Please share your location');
          return false;
        }
        break;
      case 3:
        if (formData.workingDays.length === 0) {
          setError('Please select at least one working day');
          toast.error('Please select at least one working day');
          return false;
        }
        if (formData.services.length === 0) {
          setError('Please select at least one service');
          toast.error('Please select at least one service');
          return false;
        }
        break;
      default:
        break;
    }
    setError('');
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
      toast.info(`Step ${step + 1} of 3`);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
    setError('');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          type: 'Point',
          coordinates: [position.coords.longitude, position.coords.latitude]
        };
        setLocation(loc);
        setLocationShared(true);
        setGettingLocation(false);
        toast.success('Location captured successfully!');
      },
      (err) => {
        setError(`Failed to get location: ${err.message}`);
        toast.error(`Failed to get location: ${err.message}`);
        setGettingLocation(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;

    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        operatingHours: {
          open: formData.openTime,
          close: formData.closeTime,
          days: formData.workingDays
        },
        location: location || undefined
      };
      
      console.log('Submitting blood bank registration:', submitData);
      const response = await api.post('/blood-banks/register', submitData);
      console.log('Registration response:', response.data);
      toast.success('Registration successful! Please login.');
      navigate('/blood-bank/login', { state: { message: 'Registration successful! Please login.' } });
    } catch (err) {
      console.error('Registration error:', err.response?.data || err.message);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {[1, 2, 3].map((s) => (
        <div key={s} className={`step ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
          <div className="step-number">
            {step > s ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : s}
          </div>
          <span className="step-label">
            {s === 1 && 'Account'}
            {s === 2 && 'Details'}
            {s === 3 && 'Services'}
          </span>
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <>
      <div className="form-group">
        <label htmlFor="name">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Blood Bank Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter blood bank name"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Email Address *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="bloodbank@example.com"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="phone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          Phone Number *
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Enter phone number"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Logo URL (Optional)
        </label>
        <input
          type="url"
          id="logo"
          name="logo"
          value={formData.logo}
          onChange={handleChange}
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Password *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Min 6 characters"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Confirm Password *
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm password"
            required
          />
        </div>
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="licenseNumber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            License Number *
          </label>
          <input
            type="text"
            id="licenseNumber"
            name="licenseNumber"
            value={formData.licenseNumber}
            onChange={handleChange}
            placeholder="Enter license number"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="registrationNumber">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Registration Number
          </label>
          <input
            type="text"
            id="registrationNumber"
            name="registrationNumber"
            value={formData.registrationNumber}
            onChange={handleChange}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="address">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Address *
        </label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Street address"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="city">City *</label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="City"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="state">State *</label>
          <input
            type="text"
            id="state"
            name="state"
            value={formData.state}
            onChange={handleChange}
            placeholder="State"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="pincode">Pincode *</label>
          <input
            type="text"
            id="pincode"
            name="pincode"
            value={formData.pincode}
            onChange={handleChange}
            placeholder="Pincode"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="establishedYear">Established Year</label>
          <input
            type="number"
            id="establishedYear"
            name="establishedYear"
            value={formData.establishedYear}
            onChange={handleChange}
            placeholder="e.g., 2010"
            min="1900"
            max={new Date().getFullYear()}
          />
        </div>
      </div>

      <div className="form-group location-section">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Share Location (Required) *
        </label>
        <button
          type="button"
          className={`btn-location ${locationShared ? 'shared' : ''}`}
          onClick={handleGetLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <>
              <span className="spinner-small"></span>
              Getting Location...
            </>
          ) : locationShared ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Location Shared
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Share My Location
            </>
          )}
        </button>
        {locationShared && location && (
          <div className="location-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>
              Location: {location.coordinates[1].toFixed(6)}, {location.coordinates[0].toFixed(6)}
            </span>
          </div>
        )}
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <div className="form-group">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Operating Hours
        </label>
        <div className="operating-hours-grid">
          <div className="time-input-group">
            <small>Opening Time</small>
            <input
              type="time"
              name="openTime"
              value={formData.openTime}
              onChange={handleChange}
            />
          </div>
          <div className="time-input-group">
            <small>Closing Time</small>
            <input
              type="time"
              name="closeTime"
              value={formData.closeTime}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Working Days *</label>
        <div className="services-grid">
          {allDays.map(day => (
            <label key={day} className="service-checkbox">
              <input
                type="checkbox"
                checked={formData.workingDays.includes(day)}
                onChange={() => handleDayToggle(day)}
              />
              <span>{day}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Services Offered *
        </label>
        <div className="services-grid">
          {allServices.map(service => (
            <label key={service} className="service-checkbox">
              <input
                type="checkbox"
                checked={formData.services.includes(service)}
                onChange={() => handleServiceToggle(service)}
              />
              <span>{service}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="contactPersonName">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Contact Person Name
        </label>
        <input
          type="text"
          id="contactPersonName"
          name="contactPersonName"
          value={formData.contactPersonName}
          onChange={handleChange}
          placeholder="Primary contact name"
        />
      </div>
    </>
  );

  return (
    <div className="login-page-wrapper">
      <div className="blood-bank-auth-container">
      <div className="auth-left-panel">
        <div className="auth-branding">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
            </svg>
          </div>
          <h1>Join Our Network</h1>
          <p>Register your blood bank and connect with thousands of donors</p>
        </div>
        
        <div className="auth-features">
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Quick Registration Process</span>
          </div>
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Verified & Secure Platform</span>
          </div>
          <div className="feature-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span>Large Donor Network</span>
          </div>
        </div>
      </div>

      <div className="auth-right-panel">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <h2>Register Blood Bank</h2>
            <p>Create your blood bank account</p>
          </div>

          {renderStepIndicator()}

          {error && (
            <div className="auth-alert auth-alert-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            <div className="form-navigation">
              {step > 1 && (
                <button type="button" onClick={prevStep} className="auth-btn auth-btn-secondary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                  </svg>
                  Back
                </button>
              )}
              
              {step < 3 ? (
                <button type="button" onClick={nextStep} className="auth-btn">
                  Next
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              ) : (
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      Register
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/blood-bank/login">Sign in here</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .step-indicator {
          display: flex;
          justify-content: center;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        
        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        
        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e0e0e0;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        
        .step.active .step-number {
          background: #e63946;
          color: white;
        }
        
        .step.completed .step-number {
          background: #16a34a;
          color: white;
        }
        
        .step.completed .step-number svg {
          width: 20px;
          height: 20px;
        }
        
        .step-label {
          font-size: 0.85rem;
          color: #888;
          font-weight: 500;
        }
        
        .step.active .step-label,
        .step.completed .step-label {
          color: #333;
        }
        
        .form-navigation {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        
        .form-navigation .auth-btn {
          flex: 1;
        }
        
        .auth-btn-secondary {
          background: #f0f0f0 !important;
          color: #333 !important;
        }
        
        .auth-btn-secondary:hover {
          background: #e0e0e0 !important;
          box-shadow: none !important;
        }
      `}</style>
      </div>
    </div>
  );
};

export default BloodBankRegister;

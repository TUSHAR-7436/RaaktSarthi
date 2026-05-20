import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import './SignupModal.css';

const SignupModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    bloodGroup: '',
    isDonor: false,
    needsBlood: false,
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
    },
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value,
      });
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { confirmPassword, ...registrationData } = formData;
    const result = await register(registrationData);
    
    setLoading(false);
    
    if (result.success) {
      onClose();
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await loginWithGoogle();
      
      if (result.success) {
        onClose();
        navigate('/dashboard');
      } else {
        setError(result.message || 'Google signup failed.');
      }
    } catch (err) {
      setError('An error occurred during Google signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Your Account">
      <form onSubmit={handleSubmit} className="signup-modal-form">
          {error && (
            <div className="alert alert-error">
            <span className="alert-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 6V10M10 14H10.01M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            <span>{error}</span>
            </div>
          )}        <div className="form-section-title">Personal Information</div>

        <div className="form-group">
          <label htmlFor="name">
            <span className="label-icon">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 19C3 15.134 6.13401 12 10 12C13.866 12 17 15.134 17 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            Full Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-control"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Enter your full name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">
            <span className="label-icon">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 4H17C18.1 4 19 4.9 19 6V14C19 15.1 18.1 16 17 16H3C1.9 16 1 15.1 1 14V6C1 4.9 1.9 4 3 4Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 6L10 11L1 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-control"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="your.email@example.com"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M6 9V6C6 3.79086 7.79086 2 10 2C12.2091 2 14 3.79086 14 6V9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Minimum 6 characters"
            />
          </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
              <span className="label-icon">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="3" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M6 9V6C6 3.79086 7.79086 2 10 2C12.2091 2 14 3.79086 14 6V9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              Confirm Password
              </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-control"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter password"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="phone">
              <span className="label-icon">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M10 15H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="form-control"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="bloodGroup">
              <span className="label-icon">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C10 2 5 7.5 5 12C5 14.7614 7.23858 17 10 17C12.7614 17 15 14.7614 15 12C15 7.5 10 2 10 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                </svg>
              </span>
              Blood Group *
            </label>
            <select
              id="bloodGroup"
              name="bloodGroup"
              className="form-control"
              value={formData.bloodGroup}
              onChange={handleChange}
              required
            >
              <option value="">Select Blood Group</option>
              {bloodGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="isDonor"
              checked={formData.isDonor}
              onChange={handleChange}
            />
            <span>I want to register as a blood donor</span>
          </label>
        </div>

        <div className="form-group-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="needsBlood"
              checked={formData.needsBlood}
              onChange={handleChange}
            />
            <span>I need blood / Looking for blood donors</span>
          </label>
        </div>

        <div className="form-section-title">Address (Optional)</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="address.city">City</label>
            <input
              type="text"
              id="address.city"
              name="address.city"
              className="form-control"
              value={formData.address.city}
              onChange={handleChange}
              placeholder="City"
            />
          </div>

          <div className="form-group">
            <label htmlFor="address.state">State</label>
            <input
              type="text"
              id="address.state"
              name="address.state"
              className="form-control"
              value={formData.address.state}
              onChange={handleChange}
              placeholder="State"
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner"></span>
              Creating Account...
            </>
          ) : (
            <>
              <span className="btn-icon">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M16 6L8 14L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Sign Up
            </>
          )}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          className="btn-google" 
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="blood-bank-register-link">
          <p>Are you a Blood Bank? <Link to="/blood-bank/register" onClick={onClose}>Register here</Link></p>
        </div>
      </form>
    </Modal>
  );
};

export default SignupModal;

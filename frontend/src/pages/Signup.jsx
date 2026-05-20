import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContainer';
import ImageSlider from '../components/ImageSlider';
import './Auth.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    bloodGroup: '',
    isDonor: false,
    isAvailable: false,
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
  const toast = useToast();

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
      toast.success('Account created successfully! Welcome to RaktSarthi.');
      setTimeout(() => navigate('/dashboard'), 1000);
    } else {
      setError(result.message);
      toast.error(result.message || 'Failed to create account. Please try again.');
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await loginWithGoogle();
      
      if (result.success) {
        toast.success('Successfully signed up with Google!');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setError(result.message || 'Google signup failed.');
        toast.error(result.message || 'Google signup failed.');
      }
    } catch (err) {
      setError('An error occurred during Google signup.');
      toast.error('An error occurred during Google signup.');
    } finally {
      setLoading(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <div className="login-page-wrapper">
      <div className="login-container">
        {/* Left Side - Image Slider */}
        <div className="login-slider">
          <ImageSlider />
        </div>

        {/* Right Side - Signup Form */}
        <div className="login-form-section">
        <div className="login-form-container signup-form-container">
          <div className="form-header">
            <h2>Create Your Account</h2>
            <p>Join us in saving lives through blood donation</p>
          </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 6V10M10 14H10.01M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span>{error}</span>
            </div>
          )}
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
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
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="At least 6 characters"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
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
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label htmlFor="bloodGroup">Blood Group *</label>
              <select
                id="bloodGroup"
                name="bloodGroup"
                className="form-control"
                value={formData.bloodGroup}
                onChange={handleChange}
                required
              >
                <option value="">Select Blood Group</option>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="donor-selection-section">
            <div className="form-group">
              <label>I want to register as a blood donor *</label>
              <div className="option-cards">
                <label 
                  className={`option-card ${formData.isDonor === true ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, isDonor: true })}
                >
                  <input
                    type="radio"
                    name="isDonor"
                    value="true"
                    checked={formData.isDonor === true}
                    onChange={() => setFormData({ ...formData, isDonor: true })}
                  />
                  <div className="option-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                    <span className="option-title">Yes</span>
                    <small>I want to help save lives</small>
                  </div>
                </label>

                <label 
                  className={`option-card ${formData.isDonor === false ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, isDonor: false })}
                >
                  <input
                    type="radio"
                    name="isDonor"
                    value="false"
                    checked={formData.isDonor === false}
                    onChange={() => setFormData({ ...formData, isDonor: false })}
                  />
                  <div className="option-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span className="option-title">No</span>
                    <small>Not at this time</small>
                  </div>
                </label>
              </div>
            </div>

            {formData.isDonor && (
              <div className="form-group">
                <label>Available for donation?</label>
                <div className="option-cards">
                  <label 
                    className={`option-card ${formData.isAvailable === true ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, isAvailable: true })}
                  >
                    <input
                      type="radio"
                      name="isAvailable"
                      value="true"
                      checked={formData.isAvailable === true}
                      onChange={() => setFormData({ ...formData, isAvailable: true })}
                    />
                    <div className="option-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="option-title">Yes</span>
                      <small>Ready to donate</small>
                    </div>
                  </label>

                  <label 
                    className={`option-card ${formData.isAvailable === false ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, isAvailable: false })}
                  >
                    <input
                      type="radio"
                      name="isAvailable"
                      value="false"
                      checked={formData.isAvailable === false}
                      onChange={() => setFormData({ ...formData, isAvailable: false })}
                    />
                    <div className="option-content">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span className="option-title">No</span>
                      <small>Not available now</small>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>I need blood / Looking for blood donors *</label>
              <div className="option-cards">
                <label 
                  className={`option-card ${formData.needsBlood === true ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, needsBlood: true })}
                >
                  <input
                    type="radio"
                    name="needsBlood"
                    value="true"
                    checked={formData.needsBlood === true}
                    onChange={() => setFormData({ ...formData, needsBlood: true })}
                  />
                  <div className="option-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                    <span className="option-title">Yes</span>
                    <small>I need blood urgently</small>
                  </div>
                </label>

                <label 
                  className={`option-card ${formData.needsBlood === false ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, needsBlood: false })}
                >
                  <input
                    type="radio"
                    name="needsBlood"
                    value="false"
                    checked={formData.needsBlood === false}
                    onChange={() => setFormData({ ...formData, needsBlood: false })}
                  />
                  <div className="option-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span className="option-title">No</span>
                    <small>Not looking for blood</small>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="form-section-title">Address (Optional)</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address.street">Street</label>
              <input
                type="text"
                id="address.street"
                name="address.street"
                className="form-control"
                value={formData.address.street}
                onChange={handleChange}
                placeholder="Street address"
              />
            </div>

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
          </div>

          <div className="form-row">
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

            <div className="form-group">
              <label htmlFor="address.pincode">Pincode</label>
              <input
                type="text"
                id="address.pincode"
                name="address.pincode"
                className="form-control"
                value={formData.address.pincode}
                onChange={handleChange}
                placeholder="Pincode"
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
        </form>

        <div className="form-footer">
          <p>
            Already have an account? <Link to="/login" className="form-link">Login here</Link>
          </p>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Signup;

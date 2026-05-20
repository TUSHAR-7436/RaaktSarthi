import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Create separate axios instance for Blood Bank Portal
const bloodBankAPI_instance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add blood bank token to requests
bloodBankAPI_instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bloodBankToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  googleLogin: (googleData) => api.post('/auth/google', googleData),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  updateDonorInfo: (data) => api.put('/users/donor-info', data),
  getDonors: (params) => api.get('/users/donors', { params }),
  toggleMode: (mode) => api.put('/users/toggle-mode', { mode }),
  getDashboardStats: () => api.get('/users/dashboard/stats'),
};

// Blood Bank API
export const bloodBankAPI = {
  getAll: (params) => api.get('/bloodbanks', { params }),
  getById: (id) => api.get(`/bloodbanks/${id}`),
  create: (data) => api.post('/bloodbanks', data),
  updateInventory: (id, data) => api.put(`/bloodbanks/${id}/inventory`, data),
};

// Blood Request API
export const requestAPI = {
  getAll: (params) => api.get('/requests', { params }),
  getMyRequests: () => api.get('/requests/my-requests'),
  create: (data) => api.post('/requests', data),
  update: (id, data) => api.put(`/requests/${id}`, data),
  updateStatus: (id, status) => api.patch(`/requests/${id}/status`, { status }),
};

// Event API
export const eventAPI = {
  getAll: (params) => api.get('/events', { params }),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  register: (id) => api.post(`/events/${id}/register`),
};

// Blood Camp API (for donors to view and register)
export const bloodCampAPI = {
  getAll: (params) => api.get('/blood-camps', { params }),
  getById: (id) => api.get(`/blood-camps/${id}`),
  register: (id, data) => api.post(`/blood-camps/${id}/register`, data),
};

// Blood Bank Portal API
export const bloodBankPortalAPI = {
  // Requests
  getRequests: (params) => bloodBankAPI_instance.get('/bloodbank/requests', { params }),
  getApprovedRequests: () => bloodBankAPI_instance.get('/bloodbank/requests/approved'),
  getRequestById: (id) => bloodBankAPI_instance.get(`/bloodbank/requests/${id}`),
  approveRequest: (id, data) => bloodBankAPI_instance.post(`/bloodbank/requests/${id}/approve`, data),
  rejectRequest: (id, data) => bloodBankAPI_instance.post(`/bloodbank/requests/${id}/reject`, data),
  
  // Events
  getEvents: () => bloodBankAPI_instance.get('/bloodbank/events'),
  createEvent: (data) => bloodBankAPI_instance.post('/bloodbank/events', data),
  updateEvent: (id, data) => bloodBankAPI_instance.put(`/bloodbank/events/${id}`, data),
  deleteEvent: (id) => bloodBankAPI_instance.delete(`/bloodbank/events/${id}`),
  getRegistrations: (eventId) => bloodBankAPI_instance.get(`/bloodbank/events/${eventId}/registrations`),
  exportRegistrations: (eventId) => {
    return bloodBankAPI_instance.get(`/bloodbank/events/${eventId}/export-registrations`, {
      responseType: 'blob'
    });
  },
  
  // Blood Camps
  getCamps: () => bloodBankAPI_instance.get('/bloodbank/camps'),
  getCampRegistrations: (campId) => bloodBankAPI_instance.get(`/bloodbank/camps/${campId}/registrations`),
  deleteCampRegistration: (campId, donorId) => bloodBankAPI_instance.delete(`/bloodbank/camps/${campId}/registrations/${donorId}`),
  exportCampRegistrations: (campId) => {
    return bloodBankAPI_instance.get(`/bloodbank/camps/${campId}/export-registrations`, {
      responseType: 'blob'
    });
  },
  createCamp: (data) => bloodBankAPI_instance.post('/blood-camps', data),
  updateCamp: (id, data) => bloodBankAPI_instance.put(`/blood-camps/${id}`, data),
  deleteCamp: (id) => bloodBankAPI_instance.delete(`/blood-camps/${id}`),
  
  // Dashboard
  getDashboard: () => bloodBankAPI_instance.get('/bloodbank/dashboard'),
  
  // Photo Upload
  uploadPhoto: (data) => bloodBankAPI_instance.post('/bloodbank/settings/photo', data),
  
  // Settings
  getProfile: () => bloodBankAPI_instance.get('/bloodbank/settings/profile'),
  updateProfile: (data) => bloodBankAPI_instance.put('/bloodbank/settings/profile', data),
  changePassword: (data) => bloodBankAPI_instance.put('/bloodbank/settings/password', data),
  getInventory: () => bloodBankAPI_instance.get('/bloodbank/settings/inventory'),
  updateInventory: (data) => bloodBankAPI_instance.put('/bloodbank/settings/inventory', data),
  updateBloodGroup: (bloodGroup, units) => bloodBankAPI_instance.patch(`/bloodbank/settings/inventory/${bloodGroup}`, { units }),
};

export default api;

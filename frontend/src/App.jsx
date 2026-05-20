import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ToastContainer';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import BloodBanks from './pages/BloodBanks';
import Donors from './pages/Donors';
import Events from './pages/Events';
import CreateRequest from './pages/CreateRequest';
import Profile from './pages/Profile';
import DonorHealthForm from './pages/DonorHealthForm';
import BloodBankLogin from './pages/BloodBankLogin';
import BloodBankRegister from './pages/BloodBankRegister';
import BloodBankDashboard from './pages/BloodBankDashboard';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import './App.css';

// Layout component that conditionally renders Navbar
const Layout = ({ children }) => {
  const location = useLocation();
  const noNavbarPaths = ['/blood-bank/login', '/blood-bank/register', '/blood-bank/dashboard', '/login', '/signup'];
  const showNavbar = !noNavbarPaths.some(path => location.pathname.startsWith(path));
  
  return (
    <>
      {showNavbar && <Navbar />}
      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="App">
            <Layout>
              <Routes>
              {/* Blood Bank Routes */}
              <Route path="/blood-bank/login" element={<BloodBankLogin />} />
              <Route path="/blood-bank/register" element={<BloodBankRegister />} />
              <Route path="/blood-bank/dashboard" element={<BloodBankDashboard />} />
              
              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/blood-banks" element={<PrivateRoute><BloodBanks /></PrivateRoute>} />
              <Route path="/donors" element={<PrivateRoute><Donors /></PrivateRoute>} />
              <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
              <Route path="/create-request" element={<PrivateRoute><CreateRequest /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
              <Route path="/donor-form" element={<PrivateRoute><DonorHealthForm /></PrivateRoute>} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </Layout>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

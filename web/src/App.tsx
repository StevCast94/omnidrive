import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import VehicleList from '@/pages/VehicleList';
import VehicleDetail from '@/pages/VehicleDetail';
import BookingFlow from '@/pages/BookingFlow';
import Dashboard from '@/pages/Dashboard';
import BookingDetail from '@/pages/BookingDetail';
import Wallet from '@/pages/Wallet';
import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* App shell */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/vehicles" element={<VehicleList />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />

          {/* Protected */}
          <Route path="/book/:vehicleId" element={<PrivateRoute><BookingFlow /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/bookings/:id" element={<PrivateRoute><BookingDetail /></PrivateRoute>} />
          <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

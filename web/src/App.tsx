import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/api';
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
  const { setUser, clearUser } = useAuthStore();

  // Restore session on page load / tab focus
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const { data: res } = await auth.me();
          setUser(res.data);
        } catch { clearUser(); }
      } else {
        clearUser();
      }
    });

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearUser();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token refreshed silently — no need to refetch profile
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <HashRouter>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout />}>
          <Route path="/"            element={<Home />} />
          <Route path="/vehicles"    element={<VehicleList />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/book/:vehicleId" element={<PrivateRoute><BookingFlow /></PrivateRoute>} />
          <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/bookings/:id" element={<PrivateRoute><BookingDetail /></PrivateRoute>} />
          <Route path="/wallet"      element={<PrivateRoute><Wallet /></PrivateRoute>} />
          <Route path="/profile"     element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/admin"       element={<AdminRoute><Admin /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

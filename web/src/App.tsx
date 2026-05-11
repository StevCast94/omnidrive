import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
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

const router = createBrowserRouter([
  { path: '/login',    element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    element: <Layout />,
    children: [
      { path: '/',              element: <Home /> },
      { path: '/vehicles', element: <VehicleList /> },
      { path: '/vehicles/:id',  element: <VehicleDetail /> },
      { path: '/book/:vehicleId', element: <PrivateRoute><BookingFlow /></PrivateRoute> },
      { path: '/dashboard',     element: <PrivateRoute><Dashboard /></PrivateRoute> },
      { path: '/bookings/:id',  element: <PrivateRoute><BookingDetail /></PrivateRoute> },
      { path: '/wallet',        element: <PrivateRoute><Wallet /></PrivateRoute> },
      { path: '/profile',       element: <PrivateRoute><Profile /></PrivateRoute> },
      { path: '/admin',         element: <AdminRoute><Admin /></AdminRoute> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  const { setUser, clearUser } = useAuthStore();

  // Restore session on page load / tab focus
  useEffect(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <RouterProvider router={router} />
    </>
  );
}

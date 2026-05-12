import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
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

// ===== Tiny HashRouter (zero dependencies) =====
interface RouterCtx {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterCtx>({ path: '/', params: {}, navigate: () => {} });
export const useRouter = () => useContext(RouterContext);
export const useNavigate = () => useContext(RouterContext).navigate;
export const useParams = () => useContext(RouterContext).params;

function parseHash(): string {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash;
}

interface Route {
  path: string;
  element: React.ReactNode;
  children?: Route[];
  index?: boolean;
}

function matchPath(pattern: string, actual: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);
  if (patternParts.length !== actualParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(actualParts[i]);
    } else if (patternParts[i] !== actualParts[i]) {
      return null;
    }
  }
  return params;
}

function RouterProvider({ routes }: { routes: Route[] }) {
  const [path, setPath] = useState(() => parseHash());

  useEffect(() => {
    const onHash = () => setPath(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = '#' + to;
  }, []);

  // Find matching route
  let matched: { element: React.ReactNode; params: Record<string, string> } | null = null;
  for (const route of routes) {
    const p = matchPath(route.path, path);
    if (p !== null) {
      matched = { element: route.element, params: p };
      break;
    }
  }
  if (!matched) {
    // find catch-all
    const fallback = routes.find(r => r.path === '*');
    if (fallback) matched = { element: fallback.element, params: {} };
  }
  if (!matched) {
    matched = { element: <div className="p-8 text-center text-red-400">404 — Página no encontrada</div>, params: {} };
  }

  return (
    <RouterContext.Provider value={{ path, params: matched.params, navigate }}>
      {matched.element}
    </RouterContext.Provider>
  );
}

// ===== Route guards =====
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  if (!user) {
    navigate('/login');
    return null;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  if (!user) {
    navigate('/login');
    return null;
  }
  if (user.role !== 'admin') {
    navigate('/');
    return null;
  }
  return <>{children}</>;
}

// ===== Routes config =====
const routes: Route[] = [
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/', element: <Layout><Home /></Layout> },
  { path: '/vehicles', element: <Layout><VehicleList /></Layout> },
  { path: '/vehicles/:id', element: <Layout><VehicleDetail /></Layout> },
  { path: '/book/:vehicleId', element: <Layout><PrivateRoute><BookingFlow /></PrivateRoute></Layout> },
  { path: '/dashboard', element: <Layout><PrivateRoute><Dashboard /></PrivateRoute></Layout> },
  { path: '/bookings/:id', element: <Layout><PrivateRoute><BookingDetail /></PrivateRoute></Layout> },
  { path: '/wallet', element: <Layout><PrivateRoute><Wallet /></PrivateRoute></Layout> },
  { path: '/profile', element: <Layout><PrivateRoute><Profile /></PrivateRoute></Layout> },
  { path: '/admin', element: <Layout><AdminRoute><Admin /></AdminRoute></Layout> },
  { path: '*', element: <Layout><NavigateHome /></Layout> },
];

function NavigateHome() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/'); }, []);
  return null;
}

export default function App() {
  const { setUser, clearUser } = useAuthStore();

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
      if (event === 'SIGNED_OUT' || !session) clearUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <RouterProvider routes={routes} />
    </>
  );
}

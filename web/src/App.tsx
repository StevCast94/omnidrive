import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { haySesion } from '@/lib/session';
import { metrics } from '@/lib/api';
import { usePais } from '@/lib/money';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Layout from '@/components/Layout';
import { LogoMark } from '@/components/ui/Logo';
import Home from '@/pages/Home';

// Carga diferida por ruta: el paquete inicial no tiene por que traer el mapa
// ni el panel de administracion, que no se usan en la primera visita. Importa
// sobre todo en movil con datos, que es la mayoria del trafico aqui.
const VehicleList = lazy(() => import('@/pages/VehicleList'));
const VehicleDetail = lazy(() => import('@/pages/VehicleDetail'));
const BookingFlow = lazy(() => import('@/pages/BookingFlow'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const BookingDetail = lazy(() => import('@/pages/BookingDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const Admin = lazy(() => import('@/pages/Admin'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const SelectorPais = lazy(() => import('@/pages/SelectorPais'));
const Billetera = lazy(() => import('@/pages/Billetera'));
const Legal = lazy(() => import('@/pages/Legal'));
const NoEncontrada = lazy(() => import('@/pages/NoEncontrada'));
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// ===== Tiny HashRouter (zero dependencies) =====
import { RouterContext, useNavigate, useRouter } from '@/lib/router';

interface Route {
  path: string;
  element: React.ReactNode;
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

/**
 * La ruta actual, leida del camino de la URL.
 *
 * Antes esto era un router por hash (#/vehiculos). Existia por el callback de
 * OAuth de Supabase, que devolvia el token detras del '#' y obligaba a que la
 * app viviera ahi. Ese motivo desaparecio: Google entrega el token
 * directamente y el servidor tiene su ruta comodin, asi que las URL pueden ser
 * limpias — mejor para compartir, para buscadores y para leerlas en voz alta.
 */
function rutaActual(): string {
  return window.location.pathname || '/';
}

function RouterProvider({ routes }: { routes: Route[] }) {
  const [path, setPath] = useState(() => rutaActual());

  useEffect(() => {
    // Atras y adelante del navegador.
    const alVolver = () => setPath(rutaActual());
    window.addEventListener('popstate', alVolver);

    // Enlaces con el hash viejo que alguien tenga guardados o compartidos:
    // /#/vehiculos pasa a /vehiculos sin que se note.
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      const destino = hash.slice(1);
      history.replaceState(null, '', destino);
      setPath(destino.split('?')[0]);
    }

    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    history.pushState(null, '', to);
    setPath(to.split('?')[0]);
    window.scrollTo(0, 0);
  }, []);

  // Cambia la ruta sin dejar entrada en el historial: para redirecciones,
  // donde volver atras deberia llevar a la pagina anterior, no a la que
  // acaba de redirigir.
  const navigateDirect = useCallback((to: string) => {
    history.replaceState(null, '', to);
    setPath(to.split('?')[0]);
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
    matched = { element: <div className="p-8 text-center text-red-400">404 - Página no encontrada</div>, params: {} };
  }

  return (
    <RouterContext.Provider value={{ path, params: matched.params, navigate, navigateDirect }}>
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
  if (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'verifier') {
    navigate('/');
    return null;
  }
  return <>{children}</>;
}

function VerifierRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  if (!user) {
    navigate('/login');
    return null;
  }
  if (user.role !== 'verifier') {
    navigate('/');
    return null;
  }
  return <>{children}</>;
}

// ===== Routes config =====
const routes: Route[] = [
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/paises', element: <SelectorPais /> },
  { path: '/billetera', element: <Layout><Billetera /></Layout> },
  { path: '/legal', element: <Layout><Legal /></Layout> },
  { path: '/legal/:tipo', element: <Layout><Legal /></Layout> },
  { path: '/', element: <Layout><Home /></Layout> },
  { path: '/vehicles', element: <Layout><VehicleList /></Layout> },
  { path: '/vehicles/:id', element: <Layout><VehicleDetail /></Layout> },
  { path: '/book/:vehicleId', element: <Layout><PrivateRoute><BookingFlow /></PrivateRoute></Layout> },

  { path: '/dashboard', element: <Layout><PrivateRoute><Dashboard /></PrivateRoute></Layout> },
  { path: '/bookings/:id', element: <Layout><PrivateRoute><BookingDetail /></PrivateRoute></Layout> },

  { path: '/profile', element: <Layout><PrivateRoute><Profile /></PrivateRoute></Layout> },
  { path: '/admin', element: <Admin /> },
  { path: '*', element: <Layout><NoEncontrada /></Layout> },
];


/** Lo que se ve mientras llega el trozo de la ruta. Dura milisegundos, pero
 *  con la marca en vez de un spinner cualquiera. */
function PantallaCargando() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <LogoMark className="w-16 text-[#00b1ff]" animated />
    </div>
  );
}

export default function App() {
  const { setUser, clearUser } = useAuthStore();
  const setPais = usePais(s => s.setPais);

  // Que pais sirve esta instancia decide moneda, prefijo telefonico y si aqui
  // se acepta pasaporte. Se pregunta una vez al arrancar.
  useEffect(() => {
    metrics.config().then(r => setPais(r.data.data)).catch(() => { /* se queda el valor por defecto */ });
  }, []);

  useEffect(() => {
    // Con sesion guardada se pide el perfil; el interceptor de api.ts renueva
    // el access token si hace falta. Sin sesion no se llama a nada.
    if (!haySesion()) { clearUser(); return; }

    auth.me()
      .then(res => setUser(res.data.data))
      .catch(() => clearUser());
  }, []);

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />
      <RouterProvider routes={routes} />
    </>
  );
}

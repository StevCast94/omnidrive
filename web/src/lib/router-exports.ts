// Re-export desde nuestro HashRouter custom, no desde react-router-dom
// Permite que todos los componentes sigan usando 'import { X } from 'react-router-dom''
export { useRouter, useNavigate, useParams } from '@/App';

// Implementaciones reemplazo para los otros exports de react-router-dom
import { createContext, useContext, createElement } from 'react';

// Link component
export function Link({ to, children, className, ...props }: any) {
  const { navigate } = useRouter();
  // @ts-ignore
  const onClick = (e) => { e.preventDefault(); navigate(to); };
  return createElement('a', { href: '#' + to, onClick, className, ...props }, children);
}

// useLocation
export function useLocation() {
  const { path } = useRouter();
  return { pathname: path, search: '', hash: '', state: null, key: 'default' };
}

// useSearchParams (simplified)
export function useSearchParams() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search);
  const setParams = (newParams: any) => {
    // No-op por ahora (navegación hash no usa query strings)
  };
  return [params, setParams] as const;
}

// Outlet no necesario (usamos children en Layout)
// useRouteError, etc - no exports aquí

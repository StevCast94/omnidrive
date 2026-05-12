// Router exports — reemplazo de react-router-dom
// Importa desde @/lib/router (context standalone, sin dependencias circulares)
export { useRouter, useNavigate, useParams } from '@/lib/router';

import { createElement } from 'react';
import { useRouter } from '@/lib/router';

// Link component
export function Link({ to, children, className, ...props }: any) {
  const { navigate } = useRouter();
  const onClick = (e: any) => { e.preventDefault(); navigate(to); };
  return createElement('a', { href: '#' + to, onClick, className, ...props }, children);
}

// useLocation
export function useLocation() {
  const { path } = useRouter();
  return { pathname: path, search: '', hash: '', state: null, key: 'default' };
}

// useSearchParams (simplified)
export function useSearchParams() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const setParams = (_newParams: any) => {};
  return [params, setParams] as const;
}

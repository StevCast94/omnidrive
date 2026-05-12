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

// useSearchParams: extrae query params del hash (ya que usamos HashRouter)
export function useSearchParams() {
  const getHashQuery = () => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const qIndex = hash.indexOf('?');
    return qIndex >= 0 ? hash.slice(qIndex + 1) : window.location.search.replace(/^\?/, '');
  };
  const params = new URLSearchParams(getHashQuery());
  const setParams = (_newParams: any) => {};
  return [params, setParams] as const;
}

// Router exports — reemplazo de react-router-dom
// Importa desde @/lib/router (context standalone, sin dependencias circulares)
export { useRouter, useNavigate, useNavigateDirect, useParams } from '@/lib/router';

import { createElement } from 'react';
import { useRouter } from '@/lib/router';

// Link component
export function Link({ to, children, className, ...props }: any) {
  const { navigate } = useRouter();
  const onClick = (e: any) => {
    // Ctrl/Cmd+clic, clic central o target: que el navegador haga lo suyo y
    // abra en otra pestaña. Interceptarlo todo rompe una costumbre basica.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || props.target) return;
    e.preventDefault();
    navigate(to);
  };
  // href real: se puede copiar el enlace, y un buscador lo sigue.
  return createElement('a', { href: to, onClick, className, ...props }, children);
}

// useLocation
export function useLocation() {
  const { path } = useRouter();
  return {
    pathname: path,
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: '',
    state: null,
    key: 'default',
  };
}

// Los parametros vienen del camino real, no del hash.
export function useSearchParams() {
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const setParams = (_newParams: any) => {};
  return [params, setParams] as const;
}

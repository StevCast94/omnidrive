// Router context standalone — sin dependencias circulares
// App.tsx lo provee, router-exports.ts lo consume
import { createContext, useContext } from 'react';

export interface RouterCtx {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
  navigateDirect: (to: string) => void;
}

export const RouterContext = createContext<RouterCtx>({
  path: '/',
  params: {},
  navigate: () => {},
  navigateDirect: () => {},
});

export const useRouter = () => useContext(RouterContext);
export const useNavigate = () => useContext(RouterContext).navigate;
export const useNavigateDirect = () => useContext(RouterContext).navigateDirect;
export const useParams = () => useContext(RouterContext).params;

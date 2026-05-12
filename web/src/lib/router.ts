// Router context standalone — sin dependencias circulares
// App.tsx lo provee, router-exports.ts lo consume
import { createContext, useContext } from 'react';

export interface RouterCtx {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterCtx>({
  path: '/',
  params: {},
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);
export const useNavigate = () => useContext(RouterContext).navigate;
export const useParams = () => useContext(RouterContext).params;

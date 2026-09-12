// ===== web/src/components/Layout.tsx =====
import Navbar from './Navbar';
import PushBanner from './PushBanner';
import InstallBanner from './InstallBanner';
import AvisoPais from './AvisoPais';
import { useAuthStore } from '@/lib/store';
import { usePais } from '@/lib/money';
import { Link } from '@/lib/router-exports';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const pais = usePais(s => s.pais);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <Navbar />

      {/* El aviso va DENTRO del area desplazable, no entre la barra y el
          contenido: Navbar es fixed, asi que un hermano suyo se dibuja debajo
          y el aviso quedaba tapado por la barra. */}
      <main className="pt-16 flex-1">
        <AvisoPais />
        {children}
      </main>

      {/* Saber en qué país estás y poder cambiarlo tiene que estar siempre a
          mano: cada país es una base y unas cuentas distintas. */}
      <footer className="border-t border-slate-900 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">
            <span aria-hidden="true">{pais.flag}</span> OmniDrive {pais.name}
          </span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/legal/terminos" className="text-slate-400 hover:text-white transition-colors">Términos</Link>
            <Link to="/legal/privacidad" className="text-slate-400 hover:text-white transition-colors">Privacidad</Link>
            <Link to="/legal/cancelacion" className="text-slate-400 hover:text-white transition-colors">Cancelación</Link>
            <Link to="/paises" className="text-slate-400 hover:text-white transition-colors">Cambiar de país</Link>
          </nav>
        </div>
      </footer>

      {user && <PushBanner />}
      <InstallBanner />
    </div>
  );
}

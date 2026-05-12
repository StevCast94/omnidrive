// ===== web/src/components/Navbar.tsx =====
import { useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import NotificationBell from './NotificationBell';
import clsx from 'clsx';
import { useNavigate, useRouter } from '@/App';

export default function Navbar() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const { path } = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUser();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-xl font-bold text-white">
            <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-sm">OD</span>
            <span className="hidden sm:inline">OmniDrive</span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/" current={path} label="Inicio" />
            <NavLink to="/vehicles" current={path} label="Vehículos" />
            {user && (
              <>
                <NavLink to="/dashboard" current={path} label="Dashboard" />
                <NavLink to="/wallet" current={path} label="Billetera" />
                <NavLink to="/profile" current={path} label="Perfil" />
                {user.role === 'admin' && <NavLink to="/admin" current={path} label="Admin" />}
              </>
            )}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <NotificationBell />
                <button onClick={handleLogout} className="text-slate-400 hover:text-white transition">
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="text-slate-300 hover:text-white transition text-sm font-medium">
                  Iniciar sesión
                </button>
                <button onClick={() => navigate('/register')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                  Registrarse
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-slate-300">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pb-4 space-y-2">
          <MobileNavLink to="/" current={path} label="Inicio" onClick={() => setOpen(false)} />
          <MobileNavLink to="/vehicles" current={path} label="Vehículos" onClick={() => setOpen(false)} />
          {user && (
            <>
              <MobileNavLink to="/dashboard" current={path} label="Dashboard" onClick={() => setOpen(false)} />
              <MobileNavLink to="/wallet" current={path} label="Billetera" onClick={() => setOpen(false)} />
              <MobileNavLink to="/profile" current={path} label="Perfil" onClick={() => setOpen(false)} />
              {user.role === 'admin' && <MobileNavLink to="/admin" current={path} label="Admin" onClick={() => setOpen(false)} />}
            </>
          )}
          {!user && (
            <>
              <MobileNavLink to="/login" current={path} label="Iniciar sesión" onClick={() => setOpen(false)} />
              <MobileNavLink to="/register" current={path} label="Registrarse" onClick={() => setOpen(false)} />
            </>
          )}
          {user && (
            <button onClick={() => { handleLogout(); setOpen(false); }} className="block w-full text-left text-red-400 py-2 text-sm font-medium">
              Cerrar sesión
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

function NavLink({ to, current, label }: { to: string; current: string; label: string }) {
  const navigate = useNavigate();
  const isActive = current === to || (to !== '/' && current.startsWith(to));
  return (
    <button
      onClick={() => navigate(to)}
      className={clsx('text-sm font-medium transition', isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-white')}
    >
      {label}
    </button>
  );
}

function MobileNavLink({ to, current, label, onClick }: { to: string; current: string; label: string; onClick: () => void }) {
  const navigate = useNavigate();
  const isActive = current === to || current.startsWith(to + '/');
  return (
    <button
      onClick={() => { navigate(to); onClick(); }}
      className={clsx('block w-full text-left py-2 text-sm font-medium', isActive ? 'text-indigo-400' : 'text-slate-300')}
    >
      {label}
    </button>
  );
}

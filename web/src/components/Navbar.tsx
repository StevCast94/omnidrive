// ===== web/src/components/Navbar.tsx =====
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import NotificationBell from './NotificationBell';
import { useNavigate, useRouter } from '@/lib/router';
import { Logo } from './ui/Logo';
import { Button } from './ui/Button';
import clsx from 'clsx';

export default function Navbar() {
  const { user, clearUser } = useAuthStore();
  const navigate = useNavigate();
  const { path } = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUser();
    navigate('/login');
  };

  const userInitials = user
    ? ((user.name?.charAt(0) || '') + (user.lastName?.charAt(0) || '')).toUpperCase() || user.email.charAt(0).toUpperCase()
    : '';

  return (
    <nav className={clsx(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-400',
      scrolled
        ? 'bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-lg py-2'
        : 'bg-transparent border-b border-transparent py-4'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex-shrink-0">
            <Logo variant="horizontal" animated className={scrolled ? 'scale-90 transition-transform' : 'transition-transform'} />
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink to="/" current={path} label="Inicio" />
            <NavLink to="/vehicles" current={path} label="Vehículos" />
            {user && (
              <>
                <NavLink to="/dashboard" current={path} label="Dashboard" />
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
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white transition p-2"
                  title="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center overflow-hidden hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-shadow"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{userInitials || <UserIcon size={16} />}</span>
                  )}
                </button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Ingresar
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  Registrarse
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-slate-300 hover:text-white transition p-2">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 pb-4 pt-2 space-y-2 animate-slide-down">
          <MobileNavLink to="/" current={path} label="Inicio" onClick={() => setOpen(false)} />
          <MobileNavLink to="/vehicles" current={path} label="Vehículos" onClick={() => setOpen(false)} />
          {user && (
            <>
              <MobileNavLink to="/dashboard" current={path} label="Dashboard" onClick={() => setOpen(false)} />
              <MobileNavLink to="/profile" current={path} label="Perfil" onClick={() => setOpen(false)} />
              {user.role === 'admin' && <MobileNavLink to="/admin" current={path} label="Admin" onClick={() => setOpen(false)} />}
            </>
          )}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            {user ? (
              <button
                onClick={() => { handleLogout(); setOpen(false); }}
                className="w-full flex items-center gap-2 text-left text-red-400 hover:text-red-300 py-2 text-sm font-medium"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={() => { navigate('/login'); setOpen(false); }}>
                  Ingresar
                </Button>
                <Button variant="primary" className="w-full" onClick={() => { navigate('/register'); setOpen(false); }}>
                  Registrarse
                </Button>
              </>
            )}
          </div>
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
      className={clsx(
        'text-sm font-medium relative transition-colors group',
        isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
      )}
    >
      {label}
      <span className={clsx(
        'absolute -bottom-1 left-1/2 h-0.5 bg-cyan-400 transition-all duration-300',
        isActive ? 'w-full left-0' : 'w-0 group-hover:w-full group-hover:left-0'
      )} />
    </button>
  );
}

function MobileNavLink({ to, current, label, onClick }: { to: string; current: string; label: string; onClick: () => void }) {
  const navigate = useNavigate();
  const isActive = current === to || current.startsWith(to + '/');
  return (
    <button
      onClick={() => { navigate(to); onClick(); }}
      className={clsx(
        'block w-full text-left py-2 text-sm font-medium',
        isActive ? 'text-cyan-400' : 'text-slate-300 hover:text-white'
      )}
    >
      {label}
    </button>
  );
}

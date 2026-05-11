import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import clsx from 'clsx';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = [
    { to: '/vehicles', label: 'Explorar' },
    ...(user ? [
      { to: '/dashboard', label: 'Mis reservas' },
      { to: '/wallet', label: 'Wallet' },
      { to: '/profile', label: 'Perfil' },
      ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
    ] : []),
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center h-8">
          <img
            src="/icons/logo.svg" alt="OmniDrive" width={160} height={32} className="h-8 w-auto"
            onError={e => {
              const el = e.currentTarget;
              el.style.display = 'none';
              el.insertAdjacentHTML('afterend',
                '<span class="font-bold text-xl text-white">Omni<span class="text-indigo-400">Drive</span></span>'
              );
            }}
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={clsx('text-sm font-medium transition-colors',
                location.pathname.startsWith(l.to) ? 'text-indigo-400' : 'text-slate-300 hover:text-white'
              )}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">
                ${Number(user.walletBalance).toFixed(2)}
              </span>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                {user.name[0]}{user.lastName[0]}
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Iniciar sesión</Link>
              <Link to="/register" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
                Registrarse
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-slate-300" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 px-4 py-4 flex flex-col gap-4">
          {links.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              className="text-sm font-medium text-slate-300 hover:text-white py-2">
              {l.label}
            </Link>
          ))}
          {user ? (
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 py-2">
              <LogOut size={16} /> Cerrar sesión
            </button>
          ) : (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <Link to="/login" onClick={() => setOpen(false)} className="text-sm text-slate-300 py-2">Iniciar sesión</Link>
              <Link to="/register" onClick={() => setOpen(false)}
                className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-center">
                Registrarse
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

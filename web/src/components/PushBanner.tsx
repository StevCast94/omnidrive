import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePush } from '@/hooks/usePush';

export default function PushBanner() {
  const { permission, subscribed, request } = usePush();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('push_dismissed'));

  const dismiss = () => {
    localStorage.setItem('push_dismissed', '1');
    setDismissed(true);
  };

  if (subscribed || permission === 'denied' || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Activa las notificaciones</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Recibe alertas de tus reservas, pagos y mensajes en tiempo real.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => { await request(); dismiss(); }}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition-colors"
            >
              Activar
            </button>
            <button onClick={dismiss} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 transition-colors">
              Ahora no
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

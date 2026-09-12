// ===== web/src/components/NotificationBell.tsx =====
import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate, useParams, Link } from '@/lib/router-exports';
import { useNotifications } from '@/hooks/useNotifications';

const TYPE_EMOJI: Record<string, string> = {
  booking_request:   '🚗',
  booking_confirmed: '✅',
  booking_active:    '🚀',
  booking_completed: '🏁',
  review_received:   '⭐',
  dispute_opened:    '⚠️',
  dispute_resolved:  '⚖️',
  identity_verified: '🪪',
  payment_received:  '💰',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: any) => {
    markRead(n.id);
    if (n.data?.bookingId) navigate("/bookings/" + n.data.bookingId);
    else if (n.type === "identity_rejected") navigate("/profile?tab=verificacion");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">Notificaciones</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                <CheckCheck size={12} /> Leer todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">Sin notificaciones</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800 cursor-pointer transition-colors hover:bg-slate-800/60 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_EMOJI[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${!n.read ? 'text-white' : 'text-slate-300'}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</p>}
                    <p className="text-xs text-slate-600 mt-1">
                      {new Date(n.createdAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

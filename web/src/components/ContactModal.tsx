// ===== web/src/components/ContactModal.tsx =====
// Chat deshabilitado — pendiente implementación futura
import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/router-exports';
import {
  X, Phone,
  Star, User, BadgeCheck, Car, Award, ExternalLink
} from 'lucide-react';
import { users as usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  bookingId?: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
  };
  targetUser: {
    id: string;
    name?: string;
    phone?: string;
  };
}

export default function ContactModal({ open, onClose, bookingId, vehicle, targetUser }: ContactModalProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'perfil' | 'contacto'>(bookingId ? 'contacto' : 'perfil');
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setTab(bookingId ? 'contacto' : 'perfil');
      loadProfile();
    }
  }, [open, bookingId, targetUser.id]);

  const loadProfile = async () => {
    try {
      const [profRes, revRes] = await Promise.all([
        usersApi.getPublic(targetUser.id),
        usersApi.reviews(targetUser.id),
      ]);
      setProfile(profRes.data);
      setReviews(Array.isArray(revRes.data) ? revRes.data : []);
    } catch { /* silencioso */ }
  };

  const whatsappLink = targetUser.phone
    ? `https://wa.me/${targetUser.phone.replace(/[^0-9]/g, '')}?text=Hola!%20Soy%20${user?.name}%20de%20OmniDrive,%20tengo%20una%20reserva%20contigo`
    : null;

  if (!open) return null;

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-slate-800 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-white font-semibold text-sm">
              {bookingId ? `Contactar a ${targetUser.name || 'el usuario'}` : `${targetUser.name || 'Usuario'}`}
            </h3>
            <p className="text-slate-400 text-xs">{vehicle.brand} {vehicle.model}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tabs (solo si hay booking) */}
        {bookingId && (
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setTab('contacto')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'contacto' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Contactar
            </button>
            <button
              onClick={() => { setTab('perfil'); loadProfile(); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'perfil' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Perfil
            </button>
          </div>
        )}

        {user?.id === targetUser.id ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">Eres tú — no puedes contactarte a ti mismo</p>
          </div>
        ) : tab === 'perfil' || (!bookingId && tab === 'perfil') ? (
          /* Perfil del usuario */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-900 to-slate-800 rounded-full flex items-center justify-center">
                <User size={24} className="text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-semibold">{targetUser.name || profile?.name || 'Usuario'}</h4>
                  {profile?.identityVerified && <BadgeCheck size={16} className="text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-500">Miembro desde {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }) : '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <Star size={16} className="text-amber-400 mx-auto mb-1" />
                <p className="text-white text-lg font-bold">{avgRating}</p>
                <p className="text-[10px] text-slate-500">Valoración</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <Award size={16} className="text-indigo-400 mx-auto mb-1" />
                <p className="text-white text-lg font-bold">{profile?.driverScore || '—'}</p>
                <p className="text-[10px] text-slate-500">Score</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                <Car size={16} className="text-slate-400 mx-auto mb-1" />
                <p className="text-white text-lg font-bold">{profile?.totalTrips || 0}</p>
                <p className="text-[10px] text-slate-500">Viajes</p>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2">Valoraciones recibidas</h5>
              {reviews.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">Sin valoraciones aún</p>
              )}
              <div className="space-y-2">
                {reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="bg-slate-800/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={12} className={s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-600">{r.author.name}</span>
                    </div>
                    {r.comment && <p className="text-xs text-slate-400">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Contacto directo — WhatsApp */
          <div className="p-4 space-y-3">
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center gap-4 bg-green-900/20 hover:bg-green-900/30 border border-green-800/40 rounded-xl p-4 transition-colors">
                <div className="w-10 h-10 bg-green-900/50 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-green-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white text-sm font-medium">WhatsApp</p>
                  <p className="text-green-400 text-xs">Contacto externo directo</p>
                </div>
                <ExternalLink size={18} className="text-green-500" />
              </a>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-400 text-center">
                Este usuario no tiene teléfono registrado.
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => navigate('/register')}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-medium text-sm transition-colors"
            >
              Regístrate para contactar al usuario
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

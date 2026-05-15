// ===== web/src/components/ContactModal.tsx =====
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/router-exports';
import {
  X, MessageCircle, Send, Phone, Shield, ChevronRight,
  Star, User, BadgeCheck, Car, Calendar, Award, ExternalLink
} from 'lucide-react';
import { messages, users as usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  bookingId?: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    ownerId: string;
    ownerPhone?: string;
    ownerName?: string;
  };
}

export default function ContactModal({ open, onClose, bookingId, vehicle }: ContactModalProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [convId, setConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'perfil' | 'contacto' | 'chat'>(bookingId ? 'contacto' : 'perfil');
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setConvId(null);
      setChatMessages([]);
      setTab(bookingId ? 'contacto' : 'perfil');
      setNewText('');
      loadProfile();
    }
  }, [open, bookingId, vehicle.ownerId]);

  useEffect(() => {
    if (tab === 'chat' && convId) {
      loadMessages();
    }
  }, [convId, tab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadProfile = async () => {
    try {
      const [profRes, revRes] = await Promise.all([
        usersApi.getPublic(vehicle.ownerId),
        usersApi.reviews(vehicle.ownerId),
      ]);
      setProfile(profRes.data);
      setReviews(revRes.data || []);
    } catch { /* silencioso */ }
  };

  const loadMessages = async () => {
    if (!convId) return;
    try {
      const { data } = await messages.messages(convId);
      setChatMessages(data || []);
    } catch { /* silencioso */ }
  };

  const startChat = async () => {
    setLoading(true);
    try {
      const { data } = await messages.start(vehicle.id, bookingId);
      setConvId(data.id);
      setTab('chat');
      loadMessages();
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Error al iniciar chat';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!convId || !newText.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await messages.send(convId, newText.trim());
      setChatMessages(prev => [...prev, data]);
      setNewText('');
    } catch { /* silencioso */ }
    setSending(false);
  };

  const whatsappLink = vehicle.ownerPhone
    ? `https://wa.me/${vehicle.ownerPhone.replace(/[^0-9]/g, '')}?text=Hola!%20Soy%20${user?.name}%20de%20OmniDrive,%20tengo%20una%20reserva%20contigo`
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
              {bookingId ? `Contactar a ${vehicle.ownerName || 'el dueño'}` : `Dueño: ${vehicle.ownerName || '—'}`}
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

        {user?.id === vehicle.ownerId ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">Eres el dueño de este vehículo</p>
          </div>
        ) : tab === 'perfil' || (!bookingId && tab === 'perfil') ? (
          /* Perfil del dueño */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Header del perfil */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-900 to-slate-800 rounded-full flex items-center justify-center">
                <User size={24} className="text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-semibold">{profile?.name || vehicle.ownerName || 'Usuario'}</h4>
                  {profile?.identityVerified && <BadgeCheck size={16} className="text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-500">Miembro desde {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }) : '—'}</p>
              </div>
            </div>

            {/* Stats */}
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

            {/* Reviews */}
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

            {!bookingId && (
              <div className="bg-indigo-900/30 border border-indigo-800/50 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-300">Solicita una reserva para contactar directamente con el dueño</p>
              </div>
            )}
          </div>
        ) : tab === 'contacto' ? (
          /* Opciones de contacto */
          <div className="p-4 space-y-3">
            <button
              onClick={startChat}
              disabled={loading}
              className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-cyan-900/50 rounded-full flex items-center justify-center">
                <MessageCircle size={20} className="text-cyan-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">Chat en la app</p>
                <p className="text-slate-400 text-xs">Conversa con el dueño sobre tu reserva</p>
              </div>
              {loading ? (
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight size={18} className="text-slate-500" />
              )}
            </button>

            {whatsappLink && (
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
            )}
          </div>
        ) : (
          /* Chat */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">Escribe al dueño sobre tu reserva</p>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.senderId === user?.id
                      ? 'bg-cyan-600 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}>
                    {msg.senderId !== user?.id && (
                      <p className="text-xs text-slate-400 mb-1">{msg.sender.name}</p>
                    )}
                    <p>{msg.text}</p>
                    <p className="text-[10px] text-right mt-1 opacity-60">
                      {new Date(msg.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/50 border-t border-slate-800">
              <MessageCircle size={12} className="text-slate-500" />
              <span className="text-[11px] text-slate-500">Pago directo entre usuarios — sin comisiones</span>
            </div>

            <div className="p-4 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newText.trim() || sending}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 p-2.5 rounded-xl transition-colors"
                >
                  <Send size={18} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!user && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => navigate('/register')}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-medium text-sm transition-colors"
            >
              Regístrate para contactar al dueño
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

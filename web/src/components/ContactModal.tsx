// ===== web/src/components/ContactModal.tsx =====
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { X, MessageCircle, Send, Phone, Shield, ChevronRight, Info } from 'lucide-react';
import { messages } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    ownerId: string;
    ownerPhone?: string;
    ownerName?: string;
  };
}

export default function ContactModal({ open, onClose, vehicle }: ContactModalProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [convId, setConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'select' | 'chat'>('select');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setConvId(null);
      setChatMessages([]);
      setMode('select');
      setNewText('');
    }
  }, [open]);

  useEffect(() => {
    if (mode === 'chat' && convId) {
      loadMessages();
    }
  }, [convId, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadMessages = async () => {
    if (!convId) return;
    try {
      const { data } = await messages.messages(convId);
      setChatMessages(data || []);
    } catch { /* silencioso */ }
  };

  const startChat = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const { data } = await messages.start(vehicle.id);
      setConvId(data.id);
      setMode('chat');
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
    ? `https://wa.me/${vehicle.ownerPhone.replace(/[^0-9]/g, '')}?text=Hola!%20Estoy%20interesad@%20en%20tu%20${vehicle.brand}%20${vehicle.model}%20en%20OmniDrive`
    : null;

  if (!open) return null;

  const isOwner = user?.id === vehicle.ownerId;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-slate-800 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-white font-semibold text-sm">Contactar al dueño</h3>
            <p className="text-slate-400 text-xs">{vehicle.brand} {vehicle.model}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Badge futura wallet */}
        <div className="mx-4 mt-3 flex items-center gap-2 bg-indigo-900/30 border border-indigo-800/50 rounded-lg px-3 py-2">
          <Shield size={14} className="text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-300">
            Pago directo entre usuarios — <span className="text-indigo-400 font-medium">Próximamente pagos protegidos</span>
          </span>
          <ChevronRight size={14} className="text-indigo-500 ml-auto shrink-0" />
        </div>

        {isOwner ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">Eres el dueño de este vehículo</p>
          </div>
        ) : mode === 'select' ? (
          /* Selector de modo de contacto */
          <div className="p-4 space-y-3">
            {/* Opción 1: Chat interno */}
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
                <p className="text-slate-400 text-xs">Conversa directamente con el dueño</p>
              </div>
              {loading ? (
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight size={18} className="text-slate-500" />
              )}
            </button>

            {/* Opción 2: WhatsApp */}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-4 bg-green-900/20 hover:bg-green-900/30 border border-green-800/40 rounded-xl p-4 transition-colors"
              >
                <div className="w-10 h-10 bg-green-900/50 rounded-full flex items-center justify-center">
                  <Phone size={20} className="text-green-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white text-sm font-medium">WhatsApp</p>
                  <p className="text-green-400 text-xs">Contacto directo externo</p>
                </div>
                <ChevronRight size={18} className="text-green-500" />
              </a>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Info size={12} className="text-slate-600" />
              <p className="text-xs text-slate-600">Sin comisiones ni intermediarios. Tú y el dueño acuerdan directamente.</p>
            </div>
          </div>
        ) : (
          /* Chat */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">No hay mensajes aún</p>
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

            {/* Input */}
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

        {/* Acción: si no está logueado */}
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

// ===== web/src/pages/Messages.tsx =====
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/router-exports';
import { MessageCircle, Send, ArrowLeft, ChevronRight, Car, Phone } from 'lucide-react';
import { messages as messagesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadConversations = async () => {
    try {
      const { data } = await messagesApi.conversations();
      setConversations(data || []);
      const unread = (data || []).reduce((acc: number, c: any) => {
        return acc + (c.messages?.[0] && !c.messages[0].read && c.messages[0].senderId !== user?.id ? 1 : 0);
      }, 0);
      setUnreadCount(unread);
    } catch { /* silencioso */ }
    setLoading(false);
  };

  const selectConversation = async (conv: any) => {
    setSelectedConv(conv);
    try {
      const { data } = await messagesApi.messages(conv.id);
      setChatMessages(data || []);
      await messagesApi.markRead(conv.id);
      loadConversations();
    } catch { /* silencioso */ }
  };

  const sendMessage = async () => {
    if (!selectedConv || !newText.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await messagesApi.send(selectedConv.id, newText.trim());
      setChatMessages(prev => [...prev, data]);
      setNewText('');
      loadConversations();
    } catch { /* silencioso */ }
    setSending(false);
  };

  const whatsappLink = selectedConv?.otherUser?.phone
    ? `https://wa.me/${selectedConv.otherUser.phone.replace(/[^0-9]/g, '')}?text=Hola%20${selectedConv.otherUser.name}!%20Vengo%20de%20OmniDrive`
    : null;

  return (
    <div className="min-h-screen bg-slate-950 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        {!selectedConv ? (
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-cyan-900/30 rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mensajes</h1>
              <p className="text-xs text-slate-500">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Tus conversaciones'}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setSelectedConv(null); setChatMessages([]); }}
              className="text-slate-400 hover:text-white p-1">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">
                {selectedConv.otherUser?.name} {selectedConv.otherUser?.lastName}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedConv.vehicle?.brand} {selectedConv.vehicle?.model}
              </p>
            </div>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-900/20 px-3 py-1.5 rounded-lg">
                <Phone size={12} /> WhatsApp
              </a>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !selectedConv ? (
          /* Lista de conversaciones */
          <div className="space-y-2">
            {conversations.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle size={40} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No tienes conversaciones activas</p>
                <p className="text-slate-600 text-xs mt-1">Contacta a dueños desde los vehículos</p>
              </div>
            )}
            {conversations.map(conv => {
              const lastMsg = conv.messages?.[0];
              const isUnread = lastMsg && !lastMsg.read && lastMsg.senderId !== user?.id;
              return (
                <button key={conv.id} onClick={() => selectConversation(conv)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                    isUnread ? 'bg-slate-800/80 border-cyan-800/50' : 'bg-slate-900 border-slate-800 hover:bg-slate-800/50'
                  }`}>
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                    {conv.vehicle?.photos?.[0] ? (
                      <img src={conv.vehicle.photos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Car size={18} className="text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                        {conv.otherUser?.name} {conv.otherUser?.lastName}
                      </span>
                      {isUnread && <span className="w-2 h-2 bg-cyan-400 rounded-full shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {conv.vehicle?.brand} {conv.vehicle?.model}
                    </p>
                    {lastMsg && (
                      <p className={`text-xs truncate mt-0.5 ${isUnread ? 'text-slate-300' : 'text-slate-600'}`}>
                        {lastMsg.text}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-600">
                      {lastMsg ? new Date(lastMsg.createdAt).toLocaleDateString('es-EC', { month: 'short', day: 'numeric' }) : ''}
                    </p>
                    <ChevronRight size={14} className="text-slate-600 ml-auto mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Chat */
          <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">Inicia la conversación</p>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.senderId === user?.id
                      ? 'bg-cyan-600 text-white rounded-br-md'
                      : 'bg-slate-800 text-slate-200 rounded-bl-md'
                  }`}>
                    {msg.senderId !== user?.id && (
                      <p className="text-xs text-cyan-400 mb-1">{msg.sender.name}</p>
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

            {/* Badge P2P */}
            <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/50 border-t border-slate-800">
              <MessageCircle size={12} className="text-slate-500" />
              <span className="text-[11px] text-slate-500">Pago directo entre usuarios — sin comisiones</span>
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
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, Plus, Minus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { payments } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  deposit:      { label: 'Depósito',    color: 'text-green-400',  sign: '+' },
  withdrawal:   { label: 'Retiro',      color: 'text-red-400',    sign: '-' },
  payment:      { label: 'Pago',        color: 'text-blue-400',   sign: '-' },
  refund:       { label: 'Reembolso',   color: 'text-green-400',  sign: '+' },
  commission:   { label: 'Comisión',    color: 'text-slate-400',  sign: '-' },

};

type Modal = '' | 'deposit' | 'withdraw';

export default function Wallet() {
  const { user, updateUser } = useAuthStore();
  const [balance, setBalance] = useState<number>(Number(user?.walletBalance ?? 0));
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>('');
  const [amount, setAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data: res } = await payments.wallet();
      setBalance(Number(res.data.balance));
      setTransactions(res.data.transactions);
      updateUser({ walletBalance: Number(res.data.balance) });
    } catch { toast.error('Error al cargar wallet'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Monto inválido');
    setSubmitting(true);
    try {
      // Step 1: create intent
      const { data: res1 } = await payments.deposit({ amount: amt });
      // MVP: auto-confirm (Stripe Elements would handle this in production)
      const { data: res2 } = await payments.deposit({ paymentIntentId: res1.data.paymentIntentId });
      toast.success(`$${amt.toFixed(2)} agregados a tu wallet`);
      setModal(''); setAmount(''); fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al depositar');
    } finally { setSubmitting(false); }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Monto inválido');
    if (amt > balance) return toast.error('Saldo insuficiente');
    if (!bankAccount) return toast.error('Ingresa tu número de cuenta');
    setSubmitting(true);
    try {
      await payments.withdraw({ amount: amt, bankAccount });
      toast.success('Solicitud de retiro enviada. Se procesará en 1-3 días hábiles.');
      setModal(''); setAmount(''); setBankAccount(''); fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al retirar');
    } finally { setSubmitting(false); }
  };

  const fmt = (n: number) => `$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Wallet</h1>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-200 text-sm mb-2">
            <WalletIcon size={16} /> Saldo disponible
          </div>
          {loading ? (
            <div className="h-12 w-36 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-5xl font-bold text-white">${balance.toFixed(2)}</p>
          )}
          <p className="text-indigo-200 text-xs mt-2">USD · OmniDrive Wallet</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { setModal('deposit'); setAmount(''); }}
          className="flex items-center justify-center gap-2 py-3.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/20 text-green-400 rounded-2xl font-medium text-sm transition-colors">
          <Plus size={16} /> Depositar
        </button>
        <button onClick={() => { setModal('withdraw'); setAmount(''); setBankAccount(''); }}
          className="flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-2xl font-medium text-sm transition-colors">
          <Minus size={16} /> Retirar
        </button>
      </div>

      {/* Transactions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-white">Historial</h3>
          <button onClick={fetch} className="text-slate-500 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-800 rounded animate-pulse w-1/3" />
                  <div className="h-2 bg-slate-800 rounded animate-pulse w-1/4" />
                </div>
                <div className="h-4 bg-slate-800 rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <WalletIcon size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin movimientos aún</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.map(t => {
              const cfg = TYPE_CONFIG[t.type] ?? { label: t.type, color: 'text-slate-400', sign: '' };
              const isIncome = ['deposit', 'refund'].includes(t.type) || t.toUserId === user?.id;
              return (
                <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-green-500/10' : 'bg-slate-800'}`}>
                    {isIncome
                      ? <ArrowDownLeft size={18} className="text-green-400" />
                      : <ArrowUpRight size={18} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{cfg.label}</p>
                    <p className="text-xs text-slate-500 truncate">{t.description ?? '—'}</p>
                    <p className="text-xs text-slate-600">{new Date(t.createdAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${isIncome ? 'text-green-400' : 'text-slate-300'}`}>
                      {isIncome ? '+' : '-'}{fmt(Number(t.amount))}
                    </p>
                    <p className={`text-xs capitalize ${t.status === 'completed' ? 'text-slate-600' : t.status === 'pending' ? 'text-yellow-500' : 'text-red-400'}`}>
                      {t.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit modal */}
      {modal === 'deposit' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-5">
            <h3 className="font-bold text-white text-lg">Depositar fondos</h3>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Monto (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  min="1" step="0.01" placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${amount === String(v) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                  ${v}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">En el MVP el pago se simula. En producción usarías Stripe Elements.</p>
            <div className="flex gap-3">
              <button onClick={() => setModal('')} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleDeposit} disabled={submitting || !amount}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                {submitting ? 'Procesando...' : `Depositar $${amount || '0'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {modal === 'withdraw' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-5">
            <h3 className="font-bold text-white text-lg">Retirar fondos</h3>
            <p className="text-sm text-slate-400">Saldo disponible: <span className="text-white font-medium">${balance.toFixed(2)}</span></p>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Monto (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  min="1" max={balance} step="0.01" placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Número de cuenta bancaria</label>
              <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                placeholder="Ej: 2200123456789"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>
            <p className="text-xs text-slate-500">Los retiros se procesan en 1-3 días hábiles a tu cuenta bancaria ecuatoriana.</p>
            <div className="flex gap-3">
              <button onClick={() => setModal('')} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleWithdraw} disabled={submitting || !amount || !bankAccount}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
                {submitting ? 'Procesando...' : 'Retirar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

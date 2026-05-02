import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import { fetchMyWallet, fetchMyLedger, type WalletAccount } from '../../services/storeListingService';
import { requestWithdrawal, fetchMyWithdrawals, cancelWithdrawal, type WithdrawalRequest } from '../../services/withdrawalService';
import { startWalletTopup } from '../../services/paymentService';
import { useSession } from '../../hooks/useSession';
import { currency } from '../../lib/quirkify';
import { cn } from '../../lib/utils';

interface LedgerEntry {
  id: string;
  amount: number;
  entryType: string;
  referenceType?: string;
  createdAt: string;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  top_up: 'Wallet Top-Up',
  order_payment: 'Purchase',
  auction_win: 'Auction Win',
  withdrawal_reserved: 'Withdrawal (Pending)',
  withdrawal_refunded: 'Withdrawal Refund',
  refund: 'Refund',
  bonus: 'Bonus',
  admin_credit: 'Admin Credit',
};

export default function WalletPage() {
  const { profile } = useSession();
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'topup' | 'withdraw'>('overview');
  const [topupAmount, setTopupAmount] = useState('');
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bankName: '', accountNumber: '', accountHolder: '' });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const profileId = profile?.id ?? '';

  const load = async () => {
    setLoading(true);
    try {
      const w = await fetchMyWallet();
      setWallet(w);
      const [l, wr] = await Promise.all([
        fetchMyLedger(20).catch(() => []),
        fetchMyWithdrawals().catch(() => []),
      ]);
      setLedger(l.map((e: any) => ({
        id: e.id,
        amount: Number(e.amount),
        entryType: e.entry_type ?? e.entryType ?? '',
        referenceType: e.reference_type ?? e.referenceType,
        createdAt: e.created_at ?? e.createdAt,
      })));
      setWithdrawals(wr);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount < 10) { setError('Minimum top-up is R10'); return; }
    if (amount > 50000) { setError('Maximum top-up is R50,000'); return; }
    setProcessing(true);
    setError(null);
    try {
      await startWalletTopup(amount);
    } catch (e: any) {
      setError(e.message);
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawForm.amount);
    if (!amount || amount < 50) { setError('Minimum withdrawal is R50'); return; }
    if (!wallet || amount > wallet.availableBalance) { setError('Insufficient wallet balance'); return; }
    if (!withdrawForm.bankName.trim()) { setError('Bank name is required'); return; }
    if (!withdrawForm.accountNumber.trim()) { setError('Account number is required'); return; }
    if (!withdrawForm.accountHolder.trim()) { setError('Account holder name is required'); return; }

    setProcessing(true);
    setError(null);
    try {
      await requestWithdrawal({
        profileId,
        amount,
        bankName: withdrawForm.bankName,
        accountNumber: withdrawForm.accountNumber,
        accountHolder: withdrawForm.accountHolder,
      });
      setSuccess('Withdrawal request submitted! We will process it within 2 business days.');
      setWithdrawForm({ amount: '', bankName: '', accountNumber: '', accountHolder: '' });
      setActiveTab('overview');
      await load();
    } catch (e: any) {
      setError(e.message.replace('INSUFFICIENT_BALANCE: ', 'Insufficient balance: '));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelWithdrawal = async (id: string) => {
    try {
      await cancelWithdrawal(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'requested');

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 opacity-80" />
          <p className="text-sm font-semibold opacity-80">Quirkify Wallet</p>
        </div>
        <p className="text-4xl font-black tracking-tight">
          {currency(wallet?.availableBalance ?? 0)}
        </p>
        <p className="text-sm opacity-70 mt-1">Available balance</p>
        {pendingWithdrawals.length > 0 && (
          <p className="text-xs opacity-60 mt-2">
            + {currency(pendingWithdrawals.reduce((s, w) => s + w.amount, 0))} pending withdrawal
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setActiveTab('topup'); setError(null); setSuccess(null); }}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Plus className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Top Up</p>
        </button>
        <button
          onClick={() => { setActiveTab('withdraw'); setError(null); setSuccess(null); }}
          className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Withdraw</p>
        </button>
      </div>

      {success && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl"
        >
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </motion.div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </motion.div>
      )}

      {/* Top-up panel */}
      {activeTab === 'topup' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Add funds</p>
              <button onClick={() => setActiveTab('overview')} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[100, 250, 500, 1000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(String(amt))}
                  className={cn('py-2 rounded-xl text-sm font-bold border transition-all',
                    topupAmount === String(amt)
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'border-gray-200 text-gray-700 hover:border-purple-300'
                  )}
                >
                  R{amt}
                </button>
              ))}
            </div>
            <div>
              <label className="section-label block mb-1.5">Custom amount (R)</label>
              <input
                type="number" value={topupAmount} min="10" max="50000"
                onChange={e => setTopupAmount(e.target.value)}
                placeholder="Enter amount…" className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum R10 · Maximum R50,000</p>
            </div>
            <button
              onClick={handleTopup}
              disabled={processing}
              className="btn-primary w-full justify-center"
            >
              {processing ? 'Redirecting…' : `Pay ${topupAmount ? `R${Number(topupAmount).toLocaleString()}` : '…'} via Yoco`}
            </button>
          </div>
        </motion.div>
      )}

      {/* Withdraw panel */}
      {activeTab === 'withdraw' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Withdraw funds</p>
              <button onClick={() => setActiveTab('overview')} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              Withdrawals are processed within 2 business days. Minimum R50.
              The amount is debited from your wallet immediately and refunded if rejected.
            </p>
            <div>
              <label className="section-label block mb-1.5">Amount (R) *</label>
              <input
                type="number" min="50" max={wallet?.availableBalance ?? 0}
                value={withdrawForm.amount}
                onChange={e => setWithdrawForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" className="input"
              />
              <p className="text-xs text-gray-400 mt-1">Available: {currency(wallet?.availableBalance ?? 0)}</p>
            </div>
            <div>
              <label className="section-label block mb-1.5">Bank name *</label>
              <input
                value={withdrawForm.bankName}
                onChange={e => setWithdrawForm(f => ({ ...f, bankName: e.target.value }))}
                placeholder="e.g. FNB, Standard Bank" className="input"
              />
            </div>
            <div>
              <label className="section-label block mb-1.5">Account holder *</label>
              <input
                value={withdrawForm.accountHolder}
                onChange={e => setWithdrawForm(f => ({ ...f, accountHolder: e.target.value }))}
                placeholder="Full name as on account" className="input"
              />
            </div>
            <div>
              <label className="section-label block mb-1.5">Account number *</label>
              <input
                value={withdrawForm.accountNumber}
                onChange={e => setWithdrawForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="Your bank account number" className="input"
              />
            </div>
            <button
              onClick={handleWithdraw}
              disabled={processing}
              className="btn-primary w-full justify-center"
            >
              {processing ? 'Submitting…' : 'Request Withdrawal'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Pending withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <div>
          <p className="section-label mb-3">Pending withdrawals</p>
          <div className="space-y-2">
            {pendingWithdrawals.map(w => (
              <div key={w.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">{currency(w.amount)} — Pending</p>
                  <p className="text-xs text-amber-600">{new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleCancelWithdrawal(w.id)}
                  className="text-xs text-red-500 font-semibold hover:text-red-700"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      {ledger.length > 0 && (
        <div>
          <p className="section-label mb-3">Recent transactions</p>
          <div className="space-y-2">
            {ledger.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  entry.amount > 0 ? 'bg-green-50' : 'bg-red-50'
                )}>
                  {entry.amount > 0
                    ? <ArrowDownLeft className="w-4 h-4 text-green-600" />
                    : <ArrowUpRight className="w-4 h-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className={cn('text-sm font-bold', entry.amount > 0 ? 'text-green-700' : 'text-red-600')}>
                  {entry.amount > 0 ? '+' : ''}{currency(Math.abs(entry.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ledger.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No transactions yet</p>
          <p className="text-xs mt-1">Top up your wallet to get started</p>
        </div>
      )}
    </div>
  );
}

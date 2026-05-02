import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { DollarSign, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { WithdrawalRequest, fetchAllWithdrawals, approveWithdrawal, rejectWithdrawal } from '../../services/withdrawalService';
import { useSession } from '../../hooks/useSession';
import { cn } from '../../lib/utils';

const STATUS_CONFIG = {
  requested: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved:  { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  paid:      { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:  { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function WithdrawalsPage() {
  const { profile } = useSession();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('requested');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [payRef, setPayRef] = useState('');
  const [error, setError] = useState<string | null>(null);

  const adminProfileId = profile?.id ?? '';

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllWithdrawals(filter === 'all' ? undefined : filter);
      setWithdrawals(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (w: WithdrawalRequest) => {
    setProcessing(w.id);
    try {
      await approveWithdrawal(w.id, adminProfileId, payRef || undefined);
      setPayRef('');
      setExpandedId(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (w: WithdrawalRequest) => {
    setProcessing(w.id);
    try {
      await rejectWithdrawal(w.id, adminProfileId, rejectNote || undefined);
      setRejectNote('');
      setExpandedId(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(null);
    }
  };

  const pendingTotal = withdrawals.filter(w => w.status === 'requested').reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Withdrawal Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage seller payout requests</p>
        </div>
        <button onClick={load} className="btn-secondary p-2.5">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">
            {withdrawals.filter(w => w.status === 'requested').length}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">R{pendingTotal.toLocaleString()} total</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Paid out</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {withdrawals.filter(w => w.status === 'paid').length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['requested', 'paid', 'rejected', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filter === f
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map(w => {
            const cfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.requested;
            const Icon = cfg.icon;
            const expanded = expandedId === w.id;
            return (
              <motion.div key={w.id} layout className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : w.id)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">R{w.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{new Date(w.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1', cfg.color)}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                </button>

                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-gray-100 p-4 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">Bank</p>
                        <p className="font-medium">{w.bankName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Account holder</p>
                        <p className="font-medium">{w.accountHolder || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Account number</p>
                        <p className="font-medium font-mono">{w.accountNumber || '—'}</p>
                      </div>
                      {w.reference && (
                        <div>
                          <p className="text-gray-400 text-xs">Reference</p>
                          <p className="font-medium">{w.reference}</p>
                        </div>
                      )}
                    </div>

                    {w.status === 'requested' && (
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <input
                          value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                          placeholder="Payment reference (optional)"
                          className="input text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(w)}
                            disabled={!!processing}
                            className="btn-secondary flex-1 text-red-600 border-red-200 hover:bg-red-50 text-sm"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApprove(w)}
                            disabled={!!processing}
                            className="btn-primary flex-1 text-sm justify-center"
                          >
                            {processing === w.id ? 'Processing…' : 'Mark as Paid'}
                          </button>
                        </div>
                        <textarea
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          placeholder="Rejection reason (optional)"
                          rows={2}
                          className="input text-sm resize-none"
                        />
                      </div>
                    )}
                    {w.adminNote && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{w.adminNote}</p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

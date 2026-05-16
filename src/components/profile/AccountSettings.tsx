import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Download, Trash2, AlertTriangle, Loader2, Cookie } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toaster';
import { downloadMyData, deleteMyAccount } from '../../services/accountService';
import { signOut } from '../../firebase';
import { getConsent, setConsent } from '../../lib/consent';

export default function AccountSettings() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [tracking, setTracking] = useState<boolean>(() => getConsent()?.tracking ?? false);

  useEffect(() => {
    setTracking(getConsent()?.tracking ?? false);
  }, []);

  const handleTrackingToggle = (next: boolean) => {
    setConsent(next);
    setTracking(next);
    toast.success(next ? 'Diagnostic tracking enabled' : 'Diagnostic tracking disabled. Reload to take full effect.');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMyData();
      toast.success('Your data has been downloaded.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success('Your account has been deleted.');
      try { await signOut(); } catch { /* ignore — auth user already removed server-side */ }
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? 'Deletion failed');
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container-app container-md max-w-3xl mx-auto pt-8 pb-24">
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0F0F0F] transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to profile
        </Link>
        <h1 className="text-2xl font-semibold text-[#0F0F0F] tracking-tight">Account settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">Manage your data and account.</p>

        {/* Tracking consent (POPIA s.11(3) — withdraw at any time) */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mt-6 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FAFAFA] border border-[#F3F4F6] flex items-center justify-center flex-shrink-0">
              <Cookie className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[#0F0F0F]">Diagnostic tracking</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                When enabled, we capture a short session replay if an error happens in your browser, so we can reproduce and fix it. Essential cookies for sign-in are always on.
              </p>
              <div className="flex items-center justify-between mt-4 p-3 rounded-xl bg-[#FAFAFA] border border-[#F3F4F6]">
                <span className="text-sm font-medium text-[#0F0F0F]">Allow diagnostic replays</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tracking}
                  onClick={() => handleTrackingToggle(!tracking)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tracking ? 'bg-[#0F0F0F]' : 'bg-[#D1D5DB]'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${tracking ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Right to Data Portability */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="card mt-4 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FAFAFA] border border-[#F3F4F6] flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[#0F0F0F]">Download your data</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                A JSON file with your profile, orders, addresses, collection, wallet activity and withdrawal history. Per POPIA s.24, you have the right to access the personal information we hold about you.
              </p>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="btn-secondary mt-4"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download my data
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.section>

        {/* Right to Erasure */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card mt-4 p-6 border-rose-200"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-4 h-4 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[#0F0F0F]">Delete your account</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Permanently removes your profile, saved addresses, collection and notifications. Your order history is anonymised but kept for 5 years to satisfy SARS receipt-retention requirements. This cannot be undone.
              </p>
              <ul className="text-xs text-[#6B7280] mt-3 space-y-1 list-disc list-inside">
                <li>Withdraw or spend any wallet balance first</li>
                <li>Wait for any active auction bids to settle</li>
                <li>Wait for any pending withdrawal to clear</li>
              </ul>
              <button
                type="button"
                onClick={() => { setConfirmText(''); setDeleteOpen(true); }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete my account
              </button>
            </div>
          </div>
        </motion.section>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete account"
        description="This action is permanent and irreversible."
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-900">
              Your profile and personal data will be removed. Your order receipts will be anonymised and retained for tax purposes.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-delete" className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF] block mb-1.5">
              Type <span className="font-mono text-[#0F0F0F]">DELETE</span> to confirm
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
              className="input"
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed transition-colors"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete forever
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronDown, Filter, Search } from 'lucide-react';
import { supabase } from '../../supabase';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toaster';
import { formatDate } from '../../lib/quirkify';

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  created_at: string;
};

const PAGE_SIZE = 50;

function actionTone(action: string): string {
  if (action.endsWith('.delete') || action.endsWith('.reject') || action.endsWith('.cancel')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (action.endsWith('.create') || action.endsWith('.approve')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (action.endsWith('.status_change') || action.includes('topup')) return 'bg-violet-50 text-violet-700 border-violet-200';
  if (action.endsWith('.debit') || action.endsWith('.credit') || action.endsWith('.hold')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = useMemo(() => {
    if (value == null) return null;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }, [value]);
  if (!text) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF] mb-1">{label}</div>
      <pre className="text-[12px] leading-5 font-mono bg-[#FAFAFA] border border-[#F3F4F6] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
        {text}
      </pre>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
      if (search.trim()) query = query.or(`action.ilike.%${search}%,entity_id.ilike.%${search}%,actor_label.ilike.%${search}%`);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setLogs([]);
        setHasMore(false);
      } else {
        setLogs(data || []);
        setHasMore((data || []).length === PAGE_SIZE);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [page, entityFilter, search]);

  const entityTypes = useMemo(() => ['all', 'product', 'order', 'wallet', 'withdrawal', 'campaign'], []);

  return (
    <div className="min-h-screen">
      <div className="container-app container-xl max-w-7xl mx-auto pt-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#0F0F0F] transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to admin
            </Link>
            <h1 className="text-2xl font-semibold text-[#0F0F0F] tracking-tight">Audit log</h1>
            <p className="text-sm text-[#6B7280] mt-1">Business-level state changes across the platform.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value); }}
              placeholder="Search action, actor, or entity id…"
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
            {entityTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setPage(0); setEntityFilter(type); }}
                className={`filter-pill ${entityFilter === type ? 'active' : ''}`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                <tr className="text-left text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#9CA3AF]">Loading…</td>
                  </tr>
                )}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#9CA3AF]">No audit entries match the filters.</td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${actionTone(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#0F0F0F] font-medium">
                      <span className="text-[#6B7280]">{log.entity_type}</span>
                      {log.entity_id && <span className="text-[#9CA3AF]"> · {log.entity_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6B7280] truncate max-w-[200px]">
                      {log.actor_label || (log.actor_id ? log.actor_id.slice(0, 8) : 'system')}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronDown className="w-4 h-4 text-[#D1D5DB] -rotate-90" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Pagination */}
        {(page > 0 || hasMore) && (
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-ghost"
            >
              ← Previous
            </button>
            <span className="text-xs text-[#9CA3AF] tabular-nums">Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="btn-ghost"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.action}
        description={selected ? `${selected.entity_type}${selected.entity_id ? ' · ' + selected.entity_id : ''}` : undefined}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">When</div>
                <div className="text-[#0F0F0F]">{formatDate(selected.created_at)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">Actor</div>
                <div className="text-[#0F0F0F]">{selected.actor_label || selected.actor_id || 'system'}</div>
              </div>
            </div>
            <JsonBlock label="Before" value={selected.before} />
            <JsonBlock label="After" value={selected.after} />
            <JsonBlock label="Metadata" value={selected.metadata} />
          </div>
        )}
      </Modal>
    </div>
  );
}

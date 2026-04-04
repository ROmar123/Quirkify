import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import ListingManager from './ListingManager';
import ProductIntake from './ProductIntake';
import ReviewQueue from './ReviewQueue';

type Tab = 'listings' | 'intake' | 'review';

export default function ProductsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathTab: Tab =
    location.pathname === '/admin/intake'  ? 'intake'  :
    location.pathname === '/admin/reviews' ? 'review'  : 'listings';

  const [tab, setTab] = useState<Tab>(pathTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'intake',   label: '✨ Intake' },
    { id: 'review',   label: '🔍 Review' },
    { id: 'listings', label: '📦 Products' },
  ];

  return (
    <div>
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-b border-purple-100 px-4 py-3">
        <div className="flex gap-2 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-black transition-all',
                tab === t.id
                  ? 'text-white shadow-md'
                  : 'bg-purple-50 text-purple-400 hover:bg-purple-100'
              )}
              style={tab === t.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'listings' && <ListingManager />}
      {tab === 'intake'   && <ProductIntake onSuccess={() => setTab('review')} />}
      {tab === 'review'   && <ReviewQueue />}
    </div>
  );
}

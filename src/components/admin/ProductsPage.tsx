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
    { id: 'listings', label: 'All Products' },
    { id: 'intake',   label: 'AI Intake' },
    { id: 'review',   label: 'Review Queue' },
  ];

  return (
    <div>
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-b border-purple-100 px-4">
        <div className="flex gap-1 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-3 text-sm font-bold border-b-2 transition-all',
                tab === t.id
                  ? 'border-purple-500 text-purple-700'
                  : 'border-transparent text-purple-400 hover:text-purple-600'
              )}>
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

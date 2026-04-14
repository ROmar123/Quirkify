import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import ListingManager from './ListingManager';
import ProductIntake from './ProductIntake';
import ReviewQueue from './ReviewQueue';
type Tab = 'listings' | 'intake' | 'review';

export default function ProductsPage() {
  const location = useLocation();

  const pathTab: Tab =
    location.pathname === '/admin/inventory'  ? 'intake'  :
    location.pathname === '/admin/reviews' ? 'review'  : 'listings';

  const [tab, setTab] = useState<Tab>(pathTab);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'intake',   label: 'Intake' },
    { id: 'review',   label: 'Review' },
    { id: 'listings', label: 'Products' },
  ];

  return (
    <div>
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('filter-pill', tab === t.id && 'active')}>
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

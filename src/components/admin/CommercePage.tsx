import { useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import OrderManager from './OrderManager';
import AuctionManager from './AuctionManager';
import PackManager from './PackManager';

type Tab = 'orders' | 'auctions' | 'packs';

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-32">
    <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
  </div>
);

export default function CommercePage() {
  const { pathname } = useLocation();
  const initial: Tab = pathname === '/admin/auctions' ? 'auctions' : pathname === '/admin/packs' ? 'packs' : 'orders';
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders',   label: 'Orders' },
    { id: 'auctions', label: 'Auctions' },
    { id: 'packs',    label: 'Mystery Packs' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="flex gap-3 max-w-7xl mx-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-black transition-all',
                tab === t.id ? 'text-white shadow-md' : 'bg-purple-50 text-purple-400 hover:bg-purple-100 border border-purple-100'
              )}
              style={tab === t.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          {tab === 'orders'   && <OrderManager />}
          {tab === 'auctions' && <AuctionManager />}
          {tab === 'packs'    && <PackManager />}
        </Suspense>
      </div>
    </div>
  );
}

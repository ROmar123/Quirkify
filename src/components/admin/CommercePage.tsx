import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import OrderManager from './OrderManager';
import AuctionManager from './AuctionManager';
import PackManager from './PackManager';

type Tab = 'orders' | 'auctions' | 'packs';

export default function CommercePage() {
  const { pathname } = useLocation();
  const initial: Tab = pathname === '/admin/auctions' ? 'auctions' : pathname === '/admin/packs' ? 'packs' : 'orders';
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders',   label: 'Orders' },
    { id: 'auctions', label: 'Auctions' },
    { id: 'packs',    label: 'Mystery Packs' },
  ];

  const tabClassActive = 'px-6 py-2 rounded-full text-sm font-black text-white shadow-md';
  const tabClassInactive = 'px-6 py-2 rounded-full text-sm font-black bg-purple-50 text-purple-400 hover:bg-purple-100 border border-purple-100 transition-all';

  console.log('[Commerce] Rendering, current tab:', tab);

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Tabs */}
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-purple-900 mb-4">Commerce</h1>
          <div className="flex gap-3">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { console.log('[Commerce] Switching to tab:', t.id); setTab(t.id); }}
                className={tab === t.id ? tabClassActive : tabClassInactive}
                style={tab === t.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div key={tab}>
          {tab === 'orders' && (
            <>
              <h2 className="text-lg font-bold mb-4 text-purple-900">Orders Management</h2>
              <OrderManager />
            </>
          )}
          {tab === 'auctions' && (
            <>
              <h2 className="text-lg font-bold mb-4 text-purple-900">Auctions Management</h2>
              <AuctionManager />
            </>
          )}
          {tab === 'packs' && (
            <>
              <h2 className="text-lg font-bold mb-4 text-purple-900">Mystery Packs Management</h2>
              <PackManager />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

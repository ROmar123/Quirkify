import { useState } from 'react';
import { cn } from '../../lib/utils';
import OrderManager from './OrderManager';
import AuctionManager from './AuctionManager';
import PackManager from './PackManager';

type Tab = 'orders' | 'auctions' | 'packs';

export default function CommercePage() {
  const [tab, setTab] = useState<Tab>('orders');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders',   label: 'Orders' },
    { id: 'auctions', label: 'Auctions' },
    { id: 'packs',    label: 'Mystery Packs' },
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
      {tab === 'orders'   && <OrderManager />}
      {tab === 'auctions' && <AuctionManager />}
      {tab === 'packs'    && <PackManager />}
    </div>
  );
}

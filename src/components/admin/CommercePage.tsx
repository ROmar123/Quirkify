import { useState } from 'react';
import OrderManager from './OrderManager';
import AuctionManager from './AuctionManager';
import PackManager from './PackManager';

type Tab = 'orders' | 'auctions' | 'packs';

export default function CommercePage() {
  const [tab, setTab] = useState<Tab>('orders');

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-purple-900 mb-4">Commerce</h1>
          <div className="flex gap-3">
            <button onClick={() => setTab('orders')} className={`px-6 py-2 rounded-full text-sm font-black transition-all ${tab === 'orders' ? 'text-white' : 'bg-purple-50 text-purple-400'}`} style={tab === 'orders' ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>Orders</button>
            <button onClick={() => setTab('auctions')} className={`px-6 py-2 rounded-full text-sm font-black transition-all ${tab === 'auctions' ? 'text-white' : 'bg-purple-50 text-purple-400'}`} style={tab === 'auctions' ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>Auctions</button>
            <button onClick={() => setTab('packs')} className={`px-6 py-2 rounded-full text-sm font-black transition-all ${tab === 'packs' ? 'text-white' : 'bg-purple-50 text-purple-400'}`} style={tab === 'packs' ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>Packs</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {tab === 'orders' && <OrderManager />}
        {tab === 'auctions' && <AuctionManager />}
        {tab === 'packs' && <PackManager />}
      </div>
    </div>
  );
}

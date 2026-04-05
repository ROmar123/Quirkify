import { useState } from 'react';
import { cn } from '../../lib/utils';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import InventoryDashboard from './Management/InventoryDashboard';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type View = 'onboarding' | 'dashboard' | 'products' | 'auctions' | 'packs';

const VIEWS: { id: View; label: string }[] = [
  { id: 'onboarding', label: 'New Product' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'products', label: 'Products' },
  { id: 'auctions', label: 'Auctions' },
  { id: 'packs', label: 'Packs' },
];

export default function InventoryHub() {
  const [activeView, setActiveView] = useState<View>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Inventory</h1>

          <div className="flex gap-2 overflow-x-auto pb-2 -mb-6">
            {VIEWS.map(view => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap rounded-lg border',
                  activeView === view.id
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {activeView === 'onboarding' && (
          <OnboardingFlow onComplete={() => setActiveView('dashboard')} />
        )}

        {activeView === 'dashboard' && (
          <InventoryDashboard />
        )}

        {activeView === 'products' && (
          <ProductsView />
        )}

        {activeView === 'auctions' && (
          <AuctionEditor />
        )}

        {activeView === 'packs' && (
          <PackEditor />
        )}
      </div>
    </div>
  );
}

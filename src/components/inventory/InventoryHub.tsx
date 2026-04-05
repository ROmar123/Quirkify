import { useState } from 'react';
import { Plus, Grid3X3, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import OnboardingFlow from './Onboarding/OnboardingFlow';

type View = 'onboarding' | 'dashboard' | 'products' | 'auctions' | 'packs';

const VIEWS: { id: View; label: string; icon: typeof Plus }[] = [
  { id: 'onboarding', label: 'New Product', icon: Plus },
  { id: 'dashboard', label: 'Dashboard', icon: Grid3X3 },
  { id: 'products', label: 'Products', icon: Grid3X3 },
  { id: 'auctions', label: 'Auctions', icon: Grid3X3 },
  { id: 'packs', label: 'Packs', icon: Grid3X3 },
];

export default function InventoryHub() {
  const [activeView, setActiveView] = useState<View>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b border-purple-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black gradient-text">Inventory Hub</h1>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {VIEWS.map(view => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap',
                    activeView === view.id
                      ? 'text-white border-transparent'
                      : 'bg-white text-purple-400 border-2 border-purple-100 hover:border-purple-300'
                  )}
                  style={activeView === view.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeView === 'onboarding' && (
          <OnboardingFlow onComplete={() => setActiveView('dashboard')} />
        )}

        {activeView === 'dashboard' && (
          <div className="px-4 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-black gradient-text mb-4">Dashboard</h2>
              <p className="text-purple-400">Coming soon - Stock levels, recent activity, quick actions</p>
            </div>
          </div>
        )}

        {activeView === 'products' && (
          <div className="px-4 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-black gradient-text mb-4">Products</h2>
              <p className="text-purple-400">Coming soon - Manage all products with unified editor</p>
            </div>
          </div>
        )}

        {activeView === 'auctions' && (
          <div className="px-4 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-black gradient-text mb-4">Auctions</h2>
              <p className="text-purple-400">Coming soon - Create and manage auctions</p>
            </div>
          </div>
        )}

        {activeView === 'packs' && (
          <div className="px-4 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-black gradient-text mb-4">Mystery Packs</h2>
              <p className="text-purple-400">Coming soon - Manage mystery packs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

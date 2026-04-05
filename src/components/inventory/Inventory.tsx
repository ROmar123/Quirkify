import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import MiniDashboardCards from './Dashboard/MiniDashboardCards';
import { ProductsDetailView } from './Dashboard/DetailViews';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type State = 'hub' | 'add-product' | 'products' | 'auctions' | 'packs';

export default function Inventory() {
  const [state, setState] = useState<State>('hub');

  const titles: Record<State, { title: string; description: string }> = {
    hub: { title: 'Inventory', description: 'Manage your complete inventory ecosystem' },
    'add-product': { title: 'Add Product', description: 'Create new inventory items with AI or manual entry' },
    products: { title: 'Products', description: 'Browse and manage your product catalog' },
    auctions: { title: 'Auctions', description: 'Create and manage live auctions' },
    packs: { title: 'Packs', description: 'Create and manage mystery packs' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Fixed Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-purple-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent truncate">
                {titles[state].title}
              </h1>
              <p className="text-purple-400 text-xs font-semibold mt-0.5 sm:mt-1 line-clamp-1">{titles[state].description}</p>
            </div>
            {state !== 'hub' && (
              <button
                onClick={() => setState('hub')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all whitespace-nowrap"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-8">
        <AnimatePresence mode="wait">
          {/* Hub - Mini Dashboard */}
          {state === 'hub' && (
            <motion.div key="hub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <MiniDashboardCards onSelectSection={(section) => setState(section)} />
            </motion.div>
          )}

          {/* Add Product - Onboarding Flow */}
          {state === 'add-product' && (
            <motion.div key="add-product" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <OnboardingFlow onComplete={() => setState('hub')} />
            </motion.div>
          )}

          {/* Products Detail View */}
          {state === 'products' && (
            <motion.div key="products" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <ProductsDetailView onBack={() => setState('hub')} />
            </motion.div>
          )}

          {/* Auctions - Use existing AuctionEditor */}
          {state === 'auctions' && (
            <motion.div key="auctions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <AuctionEditor />
            </motion.div>
          )}

          {/* Packs - Use existing PackEditor */}
          {state === 'packs' && (
            <motion.div key="packs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <PackEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

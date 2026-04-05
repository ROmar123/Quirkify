import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import MiniDashboardCards from './Dashboard/MiniDashboardCards';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type View = 'hub' | 'add-product' | 'products' | 'auctions' | 'packs';


const titles: Record<View, { title: string; description: string }> = {
  hub: { title: 'Inventory', description: 'Manage your complete inventory ecosystem' },
  'add-product': { title: 'Add Product', description: 'Create new inventory items with AI or manual entry' },
  'products': { title: 'Products', description: 'Browse and manage your product catalog' },
  'auctions': { title: 'Auctions', description: 'Create and manage live auctions' },
  'packs': { title: 'Packs', description: 'Create and manage mystery packs' },
};

export default function InventoryHub() {
  const [activeView, setActiveView] = useState<View>('hub');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Fixed Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-purple-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent truncate">
                {titles[activeView].title}
              </h1>
              <p className="text-purple-400 text-xs font-semibold mt-0.5 sm:mt-1 line-clamp-1">{titles[activeView].description}</p>
            </div>
            {activeView !== 'hub' && (
              <button
                onClick={() => setActiveView('hub')}
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
          {activeView === 'hub' && (
            <motion.div key="hub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <MiniDashboardCards onSelectSection={(section) => setActiveView(section)} />
            </motion.div>
          )}

          {/* Add Product - Onboarding Flow */}
          {activeView === 'add-product' && (
            <motion.div key="add-product" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <OnboardingFlow onComplete={() => setActiveView('hub')} />
            </motion.div>
          )}

          {/* Products View */}
          {activeView === 'products' && (
            <motion.div key="products" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <ProductsView />
            </motion.div>
          )}

          {/* Auctions */}
          {activeView === 'auctions' && (
            <motion.div key="auctions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <AuctionEditor />
            </motion.div>
          )}

          {/* Packs */}
          {activeView === 'packs' && (
            <motion.div key="packs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <PackEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

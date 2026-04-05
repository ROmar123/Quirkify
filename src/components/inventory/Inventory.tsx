import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Package, Gavel, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import InventoryDashboard from './Management/InventoryDashboard';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type State = 'hub' | 'add-product' | 'products' | 'auctions' | 'packs';

interface NavItem {
  id: State;
  label: string;
  icon: typeof Plus;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'add-product',
    label: 'Add Product',
    icon: Plus,
    color: 'from-pink-500 to-purple-600'
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    color: 'from-purple-500 to-indigo-600'
  },
  {
    id: 'auctions',
    label: 'Auctions',
    icon: Gavel,
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 'packs',
    label: 'Packs',
    icon: Gift,
    color: 'from-pink-500 to-rose-600'
  },
];

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
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-8">
        <AnimatePresence mode="wait">
          {/* Hub - 2 Column Grid */}
          {state === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 auto-rows-max"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(168, 85, 247, 0.15)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setState(item.id)}
                    className="bg-white rounded-2xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all group text-left"
                  >
                    <div className={cn('h-1.5 bg-gradient-to-r', item.color)} />
                    <div className="p-6">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center mb-3 text-white group-hover:scale-110 transition-transform',
                        `bg-gradient-to-br ${item.color}`
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-black text-purple-900">{item.label}</h3>
                      <div className="mt-3 inline-flex items-center text-purple-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                        Enter →
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* Add Product */}
          {state === 'add-product' && (
            <motion.div
              key="add-product"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <OnboardingFlow onComplete={() => setState('hub')} />
            </motion.div>
          )}

          {/* Products */}
          {state === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProductsView />
            </motion.div>
          )}

          {/* Auctions */}
          {state === 'auctions' && (
            <motion.div
              key="auctions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AuctionEditor />
            </motion.div>
          )}

          {/* Packs */}
          {state === 'packs' && (
            <motion.div
              key="packs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <PackEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

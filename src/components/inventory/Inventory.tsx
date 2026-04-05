import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BarChart3, Plus, Package, Gavel, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import InventoryDashboard from './Management/InventoryDashboard';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type State = 'hub' | 'add-product' | 'dashboard' | 'products' | 'auctions' | 'packs';

interface NavItem {
  id: State;
  label: string;
  icon: typeof BarChart3;
  description: string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    description: 'Overview & stock levels',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'add-product',
    label: 'Add Product',
    icon: Plus,
    description: 'AI or manual entry',
    color: 'from-pink-500 to-purple-600'
  },
  {
    id: 'products',
    label: 'Products',
    icon: Package,
    description: 'Manage inventory',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    id: 'auctions',
    label: 'Auctions',
    icon: Gavel,
    description: 'Create & manage',
    color: 'from-amber-500 to-orange-600'
  },
  {
    id: 'packs',
    label: 'Packs',
    icon: Gift,
    description: 'Mystery packs',
    color: 'from-pink-500 to-rose-600'
  },
];

export default function Inventory() {
  const [state, setState] = useState<State>('dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Inventory
              </h1>
              <p className="text-purple-400 text-sm font-semibold mt-1">Manage your entire product ecosystem</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* Hub - Main Navigation */}
        {state === 'hub' && (
          <motion.div
            key="hub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-6xl mx-auto px-4 py-12"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setState(item.id)}
                    className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all group text-left"
                  >
                    <div className={cn('h-2 bg-gradient-to-r', item.color)} />
                    <div className="p-8">
                      <div className={cn(
                        'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-white',
                        `bg-gradient-to-br ${item.color}`
                      )}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-purple-900 mb-2">{item.label}</h3>
                      <p className="text-purple-600 text-sm font-semibold">{item.description}</p>
                      <div className="mt-4 inline-flex items-center text-purple-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                        Enter <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Dashboard */}
        {state === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-4 py-12"
          >
            <NavHeader state={state} onBack={() => setState('hub')} />
            <InventoryDashboard />
          </motion.div>
        )}

        {/* Add Product */}
        {state === 'add-product' && (
          <motion.div
            key="add-product"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-4 py-12"
          >
            <NavHeader state={state} onBack={() => setState('hub')} />
            <OnboardingFlow onComplete={() => setState('dashboard')} />
          </motion.div>
        )}

        {/* Products */}
        {state === 'products' && (
          <motion.div
            key="products"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-4 py-12"
          >
            <NavHeader state={state} onBack={() => setState('hub')} />
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
            className="max-w-7xl mx-auto px-4 py-12"
          >
            <NavHeader state={state} onBack={() => setState('hub')} />
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
            className="max-w-7xl mx-auto px-4 py-12"
          >
            <NavHeader state={state} onBack={() => setState('hub')} />
            <PackEditor />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavHeader({ state, onBack }: { state: State; onBack: () => void }) {
  const titles: Record<State, { title: string; description: string }> = {
    hub: { title: '', description: '' },
    dashboard: { title: 'Dashboard', description: 'Monitor your inventory in real-time' },
    'add-product': { title: 'Add Product', description: 'Create new inventory items' },
    products: { title: 'Products', description: 'Manage your product catalog' },
    auctions: { title: 'Auctions', description: 'Create and manage live auctions' },
    packs: { title: 'Packs', description: 'Create mystery packs' },
  };

  const title = titles[state];
  if (!title.title) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-8 flex items-center justify-between"
    >
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-purple-900">{title.title}</h2>
        <p className="text-purple-400 text-sm font-semibold mt-1">{title.description}</p>
      </div>
      <button
        onClick={onBack}
        className="px-4 py-2.5 rounded-xl text-sm font-bold text-purple-700 bg-white border-2 border-purple-100 hover:border-purple-300 transition-all"
      >
        ← Back to Hub
      </button>
    </motion.div>
  );
}

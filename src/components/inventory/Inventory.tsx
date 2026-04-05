import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import MiniDashboardCards from './Dashboard/MiniDashboardCards';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type State = 'hub' | 'onboarding' | 'management' | 'auctions' | 'packs';

export default function Inventory() {
  const [state, setState] = useState<State>('hub');

  const titles: Record<State, { title: string; description: string }> = {
    hub: { title: 'Inventory', description: 'Manage your complete inventory ecosystem' },
    'onboarding': { title: 'Product Onboarding', description: 'Add new products and approve pending items' },
    'management': { title: 'Product Management', description: 'Edit approved products - store, auctions & packs' },
    'auctions': { title: 'Auctions', description: 'Create and manage live auction items' },
    'packs': { title: 'Mystery Packs', description: 'Create and manage mystery packs' },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-purple-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-purple-900 truncate">
                {titles[state].title}
              </h1>
              <p className="text-purple-400 text-xs font-semibold mt-1">{titles[state].description}</p>
            </div>
            {state !== 'hub' && (
              <button
                onClick={() => setState('hub')}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold text-purple-700 bg-purple-50 border-2 border-purple-100 hover:border-purple-300 hover:bg-purple-100 transition-all whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
        <AnimatePresence mode="wait">
          {/* Hub - Mini Dashboard Cards */}
          {state === 'hub' && (
            <motion.div key="hub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <MiniDashboardCards
                onSelectOnboarding={() => setState('onboarding')}
                onSelectManagement={() => setState('management')}
                onSelectAuctions={() => setState('auctions')}
                onSelectPacks={() => setState('packs')}
              />
            </motion.div>
          )}

          {/* Product Onboarding - Intake + Review Queue */}
          {state === 'onboarding' && (
            <motion.div key="onboarding" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <OnboardingFlow onComplete={() => setState('hub')} />
            </motion.div>
          )}

          {/* Product Management - List + Editor with Store/Auction/Packs tabs */}
          {state === 'management' && (
            <motion.div key="management" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <ProductsView onBack={() => setState('hub')} />
            </motion.div>
          )}

          {/* Auctions Management */}
          {state === 'auctions' && (
            <motion.div key="auctions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <AuctionEditor onBack={() => setState('hub')} />
            </motion.div>
          )}

          {/* Packs Management */}
          {state === 'packs' && (
            <motion.div key="packs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <PackEditor onBack={() => setState('hub')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

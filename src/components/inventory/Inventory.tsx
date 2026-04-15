import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import MiniDashboardCards from './Dashboard/MiniDashboardCards';
import ProductsView from './Management/ProductsView';

type State = 'hub' | 'onboarding' | 'management';

export default function Inventory() {
  const [state, setState] = useState<State>('hub');

  const titles: Record<State, { title: string; description: string }> = {
    hub: { title: 'Inventory', description: 'Manage your complete inventory ecosystem' },
    'onboarding': { title: 'Product Onboarding', description: 'Add new products and approve pending items' },
    'management': { title: 'Product Management', description: 'Edit approved products - store, auctions & packs' },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate tracking-tight">
                {titles[state].title}
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">{titles[state].description}</p>
            </div>
            {state !== 'hub' && (
              <button onClick={() => setState('hub')} className="btn-secondary">
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
        </AnimatePresence>
      </div>
    </div>
  );
}

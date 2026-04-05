import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Package, Gavel, Gift, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { cn } from '../../lib/utils';
import { Product, Auction } from '../../types';
import OnboardingFlow from './Onboarding/OnboardingFlow';
import ProductsView from './Management/ProductsView';
import AuctionEditor from './Management/AuctionEditor';
import PackEditor from './Management/PackEditor';

type State = 'hub' | 'add-product' | 'products' | 'auctions' | 'packs';

interface SummaryCard {
  id: State;
  label: string;
  icon: typeof Plus;
  color: string;
  stats?: { label: string; value: string | number };
}

export default function Inventory() {
  const [state, setState] = useState<State>('hub');
  const [products, setProducts] = useState<Product[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real-time data for summary cards
  useEffect(() => {
    if (state !== 'hub') return; // Only load data when on hub

    let unsubProducts: any, unsubAuctions: any;

    try {
      unsubProducts = onSnapshot(
        query(collection(db, 'products'), where('status', '==', 'approved')),
        (snap) => {
          setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'products');
          setLoading(false);
        }
      );

      unsubAuctions = onSnapshot(
        query(collection(db, 'auctions'), where('status', '==', 'active')),
        (snap) => {
          setAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Auction)));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'auctions');
          setLoading(false);
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'inventory');
      setLoading(false);
    }

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubAuctions) unsubAuctions();
    };
  }, [state]);

  // Count low-stock products
  const lowStockCount = products.filter(p => (p.stock || 0) <= 5).length;

  const cards: SummaryCard[] = [
    {
      id: 'add-product',
      label: 'Add Product',
      icon: Plus,
      color: 'from-pink-500 to-purple-600',
      stats: { label: 'Start', value: 'Now' }
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      color: 'from-purple-500 to-indigo-600',
      stats: { label: 'Total Items', value: loading ? '—' : products.length }
    },
    {
      id: 'auctions',
      label: 'Auctions',
      icon: Gavel,
      color: 'from-amber-500 to-orange-600',
      stats: { label: 'Active Now', value: loading ? '—' : auctions.length }
    },
    {
      id: 'packs',
      label: 'Packs',
      icon: Gift,
      color: 'from-pink-500 to-rose-600',
      stats: { label: 'Low Stock', value: loading ? '—' : lowStockCount }
    }
  ];

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
          {/* Hub - Summary Dashboard */}
          {state === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Low Stock Alert */}
              {!loading && lowStockCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border-2 border-red-200 rounded-3xl p-4 sm:p-5 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-black text-red-900 text-sm sm:text-base">Low Stock Alert</h3>
                    <p className="text-red-700 text-xs sm:text-sm font-semibold mt-1">
                      {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} with 5 or fewer items. Manage now.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 auto-rows-max">
                {cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <motion.button
                      key={card.id}
                      whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(168, 85, 247, 0.15)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setState(card.id)}
                      className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all group text-left shadow-sm"
                    >
                      <div className={cn('h-1.5 bg-gradient-to-r', card.color)} />
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform',
                            `bg-gradient-to-br ${card.color}`
                          )}>
                            <Icon className="w-6 h-6" />
                          </div>
                          {card.stats && (
                            <div className="text-right">
                              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">{card.stats.label}</p>
                              <p className="text-2xl font-black text-purple-900 leading-tight">{card.stats.value}</p>
                            </div>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-purple-900">{card.label}</h3>
                        <div className="mt-3 inline-flex items-center text-purple-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                          Manage →
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
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

import { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { subscribeToProducts } from '../../../services/productService';
import { motion } from 'motion/react';
import { Plus, Package, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface MiniDashboardCardsProps {
  onSelectOnboarding: () => void;
  onSelectManagement: () => void;
}

export default function MiniDashboardCards({ onSelectOnboarding, onSelectManagement }: MiniDashboardCardsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubApproved = subscribeToProducts('approved', (data) => {
      setProducts(data);
      setLoading(false);
    });

    const unsubPending = subscribeToProducts('pending', (data) => {
      setPendingProducts(data);
      setLoading(false);
    });

    return () => {
      unsubApproved();
      unsubPending();
    };
  }, []);

  // Calculate metrics
  const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);
  const totalRetailValue = products.reduce((sum, p) => sum + ((p.retailPrice || 0) * (p.stock || 0)), 0);

  const cards = [
    {
      id: 'onboarding',
      label: 'Add Product',
      icon: Plus,
      color: 'from-emerald-500 to-teal-600',
      stats: [
        { label: 'Method', value: loading ? '—' : 'AI Intake' },
        { label: 'Pending Review', value: loading ? '—' : pendingProducts.length },
        { label: 'Action', value: 'Create & Approve' }
      ],
      action: onSelectOnboarding
    },
    {
      id: 'management',
      label: 'Products',
      icon: Package,
      color: 'from-purple-500 to-indigo-600',
      stats: [
        { label: 'Active', value: loading ? '—' : products.length },
        { label: 'Total Value', value: loading ? '—' : `R${totalRetailValue.toLocaleString()}` },
        { label: 'Low Stock', value: loading ? '—' : lowStockProducts.length, alert: lowStockProducts.length > 0 }
      ],
      action: onSelectManagement
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Low Stock Alert */}
      {!loading && lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-red-900 text-sm sm:text-base">Low Stock Alert</h3>
            <p className="text-red-700 text-xs sm:text-sm font-semibold mt-1">
              {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} with 5 or fewer items. Manage in Product Management.
            </p>
          </div>
        </motion.div>
      )}

      {/* Cards Grid - 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 auto-rows-max">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(168, 85, 247, 0.1)' }}
              whileTap={{ scale: 0.98 }}
              onClick={card.action}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all group text-left shadow-sm"
            >
              {/* Gradient top bar */}
              <div className={cn('h-1.5 bg-gradient-to-r', card.color)} />

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Header: Icon + Label */}
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0',
                    `bg-gradient-to-br ${card.color}`
                  )}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex-1">{card.label}</h3>
                </div>

                {/* Stats Grid */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  {card.stats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="section-label">{stat.label}</p>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-base sm:text-lg font-bold',
                          stat.alert ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {stat.value}
                        </p>
                        {stat.alert && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div className="inline-flex items-center text-quirky font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  Open Section →
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { subscribeToProductsAdmin } from '../../../services/adminProductService';
import { motion } from 'motion/react';
import { Plus, Package, AlertTriangle, ArrowRight, Clock, TrendingUp } from 'lucide-react';

interface MiniDashboardCardsProps {
  onSelectOnboarding: () => void;
  onSelectManagement: () => void;
}

export default function MiniDashboardCards({ onSelectOnboarding, onSelectManagement }: MiniDashboardCardsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pending, setPending] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubA = subscribeToProductsAdmin('approved', d => { setProducts(d); setLoading(false); });
    const unsubP = subscribeToProductsAdmin('pending', d => { setPending(d); setLoading(false); });
    return () => { unsubA(); unsubP(); };
  }, []);

  const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
  const outOfStock = products.filter(p => (p.stock || 0) === 0);
  const totalValue = products.reduce((s, p) => s + ((p.retailPrice || 0) * (p.stock || 0)), 0);

  return (
    <div className="space-y-5">
      {/* Alert chips */}
      {!loading && (lowStock.length > 0 || outOfStock.length > 0 || pending.length > 0) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2">
          {pending.length > 0 && (
            <button onClick={onSelectOnboarding}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {pending.length} pending review
            </button>
          )}
          {outOfStock.length > 0 && (
            <button onClick={onSelectManagement}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              {outOfStock.length} out of stock
            </button>
          )}
          {lowStock.length > 0 && (
            <button onClick={onSelectManagement}
              className="flex items-center gap-2 px-3.5 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs font-semibold text-orange-800 hover:bg-orange-100 transition-colors">
              <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
              {lowStock.length} low stock
            </button>
          )}
        </motion.div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-3">
          {[
            { label: 'Live products', value: products.length },
            { label: 'Pending review', value: pending.length },
            { label: 'Retail value', value: `R${totalValue.toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="section-label mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
          onClick={onSelectOnboarding}
          className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all text-left shadow-sm"
        >
          <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5 text-white" />
              </div>
              {pending.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                  {pending.length} pending
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Add Product</h3>
            <p className="text-sm text-gray-400 mt-1">AI intake or manual entry</p>
            <div className="flex items-center gap-1 mt-5 text-xs font-semibold text-quirky group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
          onClick={onSelectManagement}
          className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all text-left shadow-sm"
        >
          <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5 text-white" />
              </div>
              {(lowStock.length > 0 || outOfStock.length > 0) && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full">
                  {outOfStock.length + lowStock.length} need attention
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Products</h3>
            <p className="text-sm text-gray-400 mt-1">{loading ? '—' : `${products.length} active`} · edit, price, allocate</p>
            <div className="flex items-center gap-1 mt-5 text-xs font-semibold text-quirky group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}

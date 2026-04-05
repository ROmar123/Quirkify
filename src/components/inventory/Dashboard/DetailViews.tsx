import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ProductsList from './ProductsList';
import ProductEditor from '../Management/ProductEditor';

export function ProductsDetailView({ onBack }: { onBack: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('approved');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (selectedProductId) {
    return <ProductEditor productId={selectedProductId} onBack={() => setSelectedProductId(null)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-purple-600" />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-purple-900">Products</h2>
          <p className="text-purple-400 text-sm font-semibold mt-1">Browse and manage your product catalog</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-purple-100 focus:border-purple-400 focus:outline-none text-sm font-semibold bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {(['all', 'approved', 'pending', 'rejected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap',
                statusFilter === status
                  ? 'text-white bg-gradient-to-r from-pink-500 to-purple-600'
                  : 'text-purple-700 bg-purple-50 border border-purple-100 hover:border-purple-300'
              )}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <ProductsList
        onSelectProduct={setSelectedProductId}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
      />
    </motion.div>
  );
}


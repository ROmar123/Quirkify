import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Edit2, Trash2, Gavel, Gift, Plus, Search, Filter } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface DashboardFilters {
  status: 'all' | 'approved' | 'pending' | 'rejected';
  searchQuery: string;
}

export default function InventoryDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<DashboardFilters>({ status: 'approved', searchQuery: '' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q;
    if (filters.status === 'all') {
      q = query(collection(db, 'products'));
    } else {
      q = query(collection(db, 'products'), where('status', '==', filters.status));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
      setLoading(false);
    });

    return unsubscribe;
  }, [filters.status]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(filters.searchQuery.toLowerCase())
  );

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;

    setDeleting(productId);
    setError(null);

    try {
      await deleteDoc(doc(db, 'products', productId));
      if (selectedProduct?.id === productId) setSelectedProduct(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      setError('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-amber-600 bg-amber-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      default: return 'text-purple-600 bg-purple-50';
    }
  };

  const getAllocationStatus = (product: Product) => {
    const total = (product.allocations?.store || 0) + (product.allocations?.auction || 0) + (product.allocations?.packs || 0);
    if (total === 0) return 'text-red-600';
    if (total < product.stock) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-purple-900">Inventory Dashboard</h1>
            <p className="text-purple-400 text-sm font-semibold mt-1">Manage products, allocations, and channels</p>
          </div>
          <button
            onClick={() => setFilters({ ...filters, status: 'all' })}
            className="px-6 py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90 w-full sm:w-auto"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-300" />
            <input
              type="text"
              placeholder="Search products..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'approved', 'pending', 'rejected'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilters({ ...filters, status })}
                className={cn(
                  'px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all whitespace-nowrap',
                  filters.status === status
                    ? 'text-white border-transparent'
                    : 'bg-white text-purple-400 border-2 border-purple-100 hover:border-purple-300'
                )}
                style={filters.status === status ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
              >
                <Filter className="w-3 h-3 inline mr-1" />
                {status}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-2">
            <span>⚠</span> {error}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-50 border-b border-purple-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-purple-700">Product</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">🏪 Store</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">🏆 Auction</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">🎁 Packs</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-purple-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3].map(i => (
                    <tr key={`skeleton-${i}`} className="border-b border-purple-100">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="h-8 bg-purple-50 animate-pulse rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="border-b border-purple-100 hover:bg-purple-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={product.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          <div>
                            <p className="font-bold text-xs text-purple-900 uppercase tracking-tight">{product.name}</p>
                            <p className="text-[10px] text-purple-400">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="font-black text-sm text-purple-900">{product.stock}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="font-bold text-xs">{product.allocations?.store || 0}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="font-bold text-xs">{product.allocations?.auction || 0}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="font-bold text-xs">{product.allocations?.packs || 0}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full',
                          getStatusColor(product.status)
                        )}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                            className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-purple-400" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                            disabled={deleting === product.id}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: Quick Stats & Actions */}
        <div className="lg:col-span-1 space-y-4">
          {selectedProduct ? (
            <motion.div
              key={selectedProduct.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6 space-y-4"
            >
              <div>
                <img src={selectedProduct.imageUrl} className="w-full h-40 rounded-2xl object-cover mb-4" alt="" />
                <h3 className="font-black text-purple-900 text-sm uppercase">{selectedProduct.name}</h3>
                <p className="text-xs text-purple-400 mt-1">{selectedProduct.description}</p>
              </div>

              <div className="pt-4 border-t border-purple-100 space-y-2">
                <div>
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Pricing</p>
                  <p className="font-bold text-sm text-purple-900">R{selectedProduct.discountPrice} <span className="text-xs text-purple-400 line-through">R{selectedProduct.retailPrice}</span></p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Stock</p>
                  <p className="font-bold text-sm text-purple-900">{selectedProduct.stock} Units</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Allocations</p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-purple-700">🏪 Store: {selectedProduct.allocations?.store || 0}</p>
                    <p className="text-xs font-semibold text-purple-700">🏆 Auction: {selectedProduct.allocations?.auction || 0}</p>
                    <p className="text-xs font-semibold text-purple-700">🎁 Packs: {selectedProduct.allocations?.packs || 0}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 hover:border-purple-300 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white rounded-3xl border border-purple-100 border-dashed shadow-sm p-6 text-center">
              <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">Select a product for details</p>
            </div>
          )}

          {/* Stats Card */}
          <div className="bg-purple-50 rounded-3xl border border-purple-100 p-6 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Inventory Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-purple-700">Total Products</span>
                  <span className="font-black text-sm text-purple-900">{filteredProducts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-purple-700">Total Units</span>
                  <span className="font-black text-sm text-purple-900">{filteredProducts.reduce((sum, p) => sum + p.stock, 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-purple-700">Allocated</span>
                  <span className="font-black text-sm text-green-600">
                    {filteredProducts.reduce((sum, p) => sum + ((p.allocations?.store || 0) + (p.allocations?.auction || 0) + (p.allocations?.packs || 0)), 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-purple-700">Unallocated</span>
                  <span className="font-black text-sm text-amber-600">
                    {filteredProducts.reduce((sum, p) => sum + (p.stock - ((p.allocations?.store || 0) + (p.allocations?.auction || 0) + (p.allocations?.packs || 0))), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

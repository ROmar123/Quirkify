import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Edit2, Trash2, ChevronRight, Search } from 'lucide-react';
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase tracking-widest">Approved</span>;
      case 'pending':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 uppercase tracking-widest">Pending</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 uppercase tracking-widest">Rejected</span>;
      default:
        return null;
    }
  };

  const getAllocationStats = (product: Product) => {
    const allocated = (product.allocations?.store || 0) + (product.allocations?.auction || 0) + (product.allocations?.packs || 0);
    const unallocated = product.stock - allocated;
    return { allocated, unallocated };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Stock Overview</h2>
          <p className="text-purple-400 text-xs sm:text-sm font-semibold mt-1">Manage your inventory and track allocations in real-time</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-purple-400" />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-900 focus:outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all placeholder-purple-300"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {(['all', 'approved', 'pending', 'rejected'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilters({ ...filters, status })}
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap uppercase tracking-widest',
                  filters.status === status
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                    : 'bg-white text-purple-600 border-2 border-purple-100 hover:border-purple-300'
                )}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 text-sm font-bold">
            {error}
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Table/List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-purple-100 animate-pulse rounded-2xl border-2 border-purple-100" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border-2 border-purple-100 shadow-sm">
              <p className="text-purple-400 text-sm font-semibold">No products found</p>
            </div>
          ) : (
            <div className="space-y-2 bg-white rounded-3xl border-2 border-purple-100 overflow-hidden shadow-sm">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-pink-50 to-purple-50 border-b-2 border-purple-100">
                    <tr>
                      <th className="text-left px-6 py-4 font-black text-purple-900">Product</th>
                      <th className="text-center px-4 py-4 font-black text-purple-900">Total</th>
                      <th className="text-center px-4 py-4 font-black text-purple-900">🏪 Store</th>
                      <th className="text-center px-4 py-4 font-black text-purple-900">🏆 Auction</th>
                      <th className="text-center px-4 py-4 font-black text-purple-900">🎁 Packs</th>
                      <th className="text-center px-4 py-4 font-black text-purple-900">Status</th>
                      <th className="text-right px-6 py-4 font-black text-purple-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-purple-100">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-purple-50 transition-colors cursor-pointer" onClick={() => setSelectedProduct(product)}>
                        <td className="px-6 py-4 font-semibold">
                          <div className="flex items-center gap-3">
                            <img src={product.imageUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            <div>
                              <p className="font-black text-purple-900 text-sm">{product.name}</p>
                              <p className="text-xs text-purple-400">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-black text-purple-900">{product.stock}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-black text-purple-900">{product.allocations?.store || 0}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-black text-purple-900">{product.allocations?.auction || 0}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-black text-purple-900">{product.allocations?.packs || 0}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(product.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(product);
                              }}
                              className="p-2 hover:bg-purple-100 rounded-xl transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-purple-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(product.id);
                              }}
                              disabled={deleting === product.id}
                              className="p-2 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y-2 divide-purple-100">
                {filteredProducts.map((product) => {
                  const stats = getAllocationStats(product);
                  return (
                    <motion.button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full p-4 text-left hover:bg-purple-50 transition-colors flex items-center gap-4"
                    >
                      <img src={product.imageUrl} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-purple-900 text-sm truncate">{product.name}</p>
                        <p className="text-xs text-purple-400 font-semibold mb-2">{product.category}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-600">{product.stock} total</span>
                          <span className="text-xs text-purple-300">•</span>
                          <span className="text-xs font-bold text-purple-600">{stats.allocated} allocated</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(product.status)}
                        <ChevronRight className="w-4 h-4 text-purple-400" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {selectedProduct ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border-2 border-purple-100 p-6 space-y-4 shadow-sm"
            >
              <div className="h-1.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full -mx-6 mb-4" />
              <img src={selectedProduct.imageUrl} className="w-full h-40 rounded-2xl object-cover mb-4" alt="" />
              <div>
                <h3 className="font-black text-purple-900 text-sm mb-2">{selectedProduct.name}</h3>
                <p className="text-xs text-purple-400 font-semibold line-clamp-3">{selectedProduct.description}</p>
              </div>

              <div className="pt-4 border-t-2 border-purple-100 space-y-3">
                <div>
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Pricing</p>
                  <p className="font-black text-sm text-purple-900">R{selectedProduct.discountPrice} <span className="text-xs text-purple-300 line-through">R{selectedProduct.retailPrice}</span></p>
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Allocations</p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-purple-900">🏪 Store: {selectedProduct.allocations?.store || 0}</p>
                    <p className="text-xs font-bold text-purple-900">🏆 Auction: {selectedProduct.allocations?.auction || 0}</p>
                    <p className="text-xs font-bold text-purple-900">🎁 Packs: {selectedProduct.allocations?.packs || 0}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full py-2.5 text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-2xl transition-colors mt-4 uppercase tracking-widest"
              >
                Close
              </button>
            </motion.div>
          ) : (
            <div className="bg-white rounded-3xl border-2 border-dashed border-purple-200 p-6 text-center shadow-sm">
              <p className="text-purple-400 text-sm font-semibold">Select a product to view details</p>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 bg-white rounded-3xl border-2 border-purple-100 p-6 space-y-4 shadow-sm">
            <div className="h-1.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full -mx-6" />
            <h4 className="font-black text-purple-900 text-sm uppercase tracking-widest">Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Total Products</span>
                <span className="font-black text-sm text-purple-900">{filteredProducts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Total Units</span>
                <span className="font-black text-sm text-purple-900">{filteredProducts.reduce((sum, p) => sum + p.stock, 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Allocated</span>
                <span className="font-black text-sm text-purple-900">
                  {filteredProducts.reduce((sum, p) => sum + ((p.allocations?.store || 0) + (p.allocations?.auction || 0) + (p.allocations?.packs || 0)), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Unallocated</span>
                <span className="font-black text-sm text-purple-900">
                  {filteredProducts.reduce((sum, p) => sum + (p.stock - ((p.allocations?.store || 0) + (p.allocations?.auction || 0) + (p.allocations?.packs || 0))), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

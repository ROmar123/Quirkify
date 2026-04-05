import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product } from '../../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Edit2, Trash2, ChevronRight } from 'lucide-react';
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
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Approved</span>;
      case 'pending':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejected</span>;
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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Stock Overview</h2>
          <p className="text-gray-600 text-sm">Manage your inventory and track allocations</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search products..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'approved', 'pending', 'rejected'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilters({ ...filters, status })}
                className={cn(
                  'px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  filters.status === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Products Table/List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500 text-sm">No products found</p>
            </div>
          ) : (
            <div className="space-y-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 font-semibold text-gray-700">Product</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Total</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Store</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Auction</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Packs</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-right px-6 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedProduct(product)}>
                        <td className="px-6 py-4 font-medium">
                          <div className="flex items-center gap-3">
                            <img src={product.imageUrl} className="w-10 h-10 rounded object-cover" alt="" />
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-semibold text-gray-900">{product.stock}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-semibold text-gray-700">{product.allocations?.store || 0}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-semibold text-gray-700">{product.allocations?.auction || 0}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <p className="font-semibold text-gray-700">{product.allocations?.packs || 0}</p>
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
                              className="p-2 hover:bg-purple-100 rounded transition-colors"
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
                              className="p-2 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
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
              <div className="md:hidden divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const stats = getAllocationStats(product);
                  return (
                    <motion.button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4"
                    >
                      <img src={product.imageUrl} className="w-12 h-12 rounded object-cover flex-shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 mb-2">{product.category}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600">{product.stock} total</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs font-semibold text-gray-600">{stats.allocated} allocated</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(product.status)}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
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
              className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
            >
              <img src={selectedProduct.imageUrl} className="w-full h-40 rounded-lg object-cover mb-4" alt="" />
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{selectedProduct.name}</h3>
                <p className="text-xs text-gray-600 line-clamp-3">{selectedProduct.description}</p>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">PRICING</p>
                  <p className="font-bold text-sm text-gray-900">R{selectedProduct.discountPrice} <span className="text-xs text-gray-400 line-through">R{selectedProduct.retailPrice}</span></p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">ALLOCATIONS</p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-700">Store: {selectedProduct.allocations?.store || 0}</p>
                    <p className="text-xs font-semibold text-gray-700">Auction: {selectedProduct.allocations?.auction || 0}</p>
                    <p className="text-xs font-semibold text-gray-700">Packs: {selectedProduct.allocations?.packs || 0}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mt-4"
              >
                Close
              </button>
            </motion.div>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
              <p className="text-gray-500 text-sm">Select a product to view details</p>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm">Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Total Products</span>
                <span className="font-bold text-sm text-gray-900">{filteredProducts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Total Units</span>
                <span className="font-bold text-sm text-gray-900">{filteredProducts.reduce((sum, p) => sum + p.stock, 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Allocated</span>
                <span className="font-bold text-sm text-green-600">
                  {filteredProducts.reduce((sum, p) => sum + ((p.allocations?.store || 0) + (p.allocations?.auction || 0) + (p.allocations?.packs || 0)), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Unallocated</span>
                <span className="font-bold text-sm text-amber-600">
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

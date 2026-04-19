import { useState, useEffect, useRef } from 'react';
import { auth } from '../../firebase';
import { Product, ProductCondition } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Edit3, Trash2, Save, X, Plus, ShoppingBag, Camera, Loader2, Package, Gavel } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { uploadProductImage } from '../../services/storageService';
import { identifyProduct } from '../../services/gemini';
import { subscribeToProductsAdmin } from '../../services/adminProductService';
import { createProduct, updateProduct, deleteProduct } from '../../services/productService';

type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected';

const CONDITIONS: ProductCondition[] = ['New', 'Like New', 'Pre-owned', 'Refurbished'];
const LISTING_TYPES = ['store', 'auction', 'both'] as const;

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

const BLANK_PRODUCT = {
  name: '', description: '', category: '', imageUrl: '',
  priceRange: { min: 0, max: 0 },
  retailPrice: 0, markdownPercentage: 40, discountPrice: 0,
  condition: 'New' as ProductCondition,
  stock: 1, listingType: 'store' as typeof LISTING_TYPES[number],
  status: 'approved' as const,
};

export default function ListingManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState('Saving…');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToProductsAdmin(undefined, (data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditingProduct({ id: '', ...BLANK_PRODUCT } as any);
    setIsNew(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct({
      ...p,
      retailPrice: p.retailPrice ?? 0,
      markdownPercentage: p.markdownPercentage ?? 40,
      discountPrice: p.discountPrice ?? 0,
      listingType: p.listingType ?? 'store',
    });
    setIsNew(false);
  };

  const closeModal = () => {
    setEditingProduct(null);
    setIsNew(false);
    setImageFiles([]);
    setImagePreviews([]);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (i: number) => {
    const files = imageFiles.filter((_, idx) => idx !== i);
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    if (!editingProduct.name?.trim()) { setError('Product name is required'); return; }
    if (!editingProduct.description?.trim()) { setError('Description is required'); return; }
    if (!editingProduct.category?.trim()) { setError('Category is required'); return; }
    if (!editingProduct.retailPrice || editingProduct.retailPrice <= 0) { setError('Retail price must be greater than 0'); return; }
    if (!editingProduct.stock || editingProduct.stock <= 0) { setError('Stock must be at least 1'); return; }
    if (isNew && !editingProduct.imageUrl && imageFiles.length === 0) { setError('Product image is required'); return; }

    const totalAllocated = (editingProduct.allocations?.store || 0) + (editingProduct.allocations?.auction || 0) + (editingProduct.allocations?.packs || 0);
    if (totalAllocated > (editingProduct.stock || 0)) {
      setError(`Total allocated (${totalAllocated}) cannot exceed total stock (${editingProduct.stock})`);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let imageUrl = editingProduct.imageUrl;
      let imageUrls: string[] = imageUrl ? [imageUrl] : [];
      let confidenceScore = editingProduct.confidenceScore ?? 0;

      if (imageFiles.length > 0) {
        setSavingMsg('Uploading images…');
        // Use a temp UUID for the storage path (Supabase generates the real product ID server-side)
        const tempId = isNew ? crypto.randomUUID() : editingProduct.id;
        imageUrls = await Promise.all(imageFiles.map(f => uploadProductImage(tempId, f)));
        imageUrl = imageUrls[0];

        setSavingMsg('Getting AI confidence…');
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((res, rej) => {
            reader.onload = () => res((reader.result as string).split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(imageFiles[0]);
          });
          const ai = await identifyProduct(base64);
          confidenceScore = ai.confidenceScore ?? 0;
        } catch { /* non-fatal */ }
      }

      setSavingMsg('Saving…');
      const payload: Partial<Product> = {
        name: editingProduct.name,
        description: editingProduct.description,
        category: editingProduct.category,
        imageUrl: imageUrl ?? '',
        imageUrls,
        confidenceScore,
        priceRange: { min: editingProduct.discountPrice || editingProduct.retailPrice, max: editingProduct.retailPrice },
        retailPrice: editingProduct.retailPrice,
        markdownPercentage: editingProduct.markdownPercentage,
        condition: editingProduct.condition,
        stock: editingProduct.stock,
        totalStock: editingProduct.stock,
        allocations: editingProduct.allocations || { store: 0, auction: 0, packs: 0 },
        listingType: editingProduct.listingType,
        status: editingProduct.status,
      };

      if (isNew) {
        await createProduct({ ...payload, authorUid: auth.currentUser?.uid ?? '' });
      } else {
        await updateProduct(editingProduct.id, payload);
      }
      closeModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
      setSavingMsg('Saving…');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete product');
    }
  };

  const setField = (key: string, value: any) => {
    if (!editingProduct) return;
    const updated = { ...editingProduct, [key]: value };
    if (key === 'retailPrice' || key === 'markdownPercentage') {
      const retail = key === 'retailPrice' ? value : updated.retailPrice;
      const pct = key === 'markdownPercentage' ? value : updated.markdownPercentage;
      updated.discountPrice = Math.round(retail * (1 - pct / 100));
      updated.priceRange = { min: updated.discountPrice, max: retail };
    }
    setEditingProduct(updated);
  };

  const inputCls = 'input';
  const labelCls = 'section-label block mb-1.5';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Listings</h1>
          <p className="text-gray-400 text-sm">{products.length} total products</p>
        </div>
        <button onClick={openNew} className="btn-primary px-5 py-2.5 text-sm">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className={cn(inputCls, 'pl-10')} />
        </div>
        <div className="flex gap-2">
          {(['all', 'approved', 'pending', 'rejected'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn('filter-pill capitalize', statusFilter === s && 'active')}>{s}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-gray-100 bg-white">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium text-sm">No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all">
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <Package className="w-6 h-6 text-gray-200 m-auto mt-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{p.name || '(no name)'}</p>
                <p className="text-xs text-gray-400">{p.category} · {p.condition} · Stock: {p.stock ?? '—'}</p>
              </div>
              <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                {(p.listingType === 'store' || p.listingType === 'both') && <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600"><ShoppingBag className="w-3 h-3" />Store</span>}
                {(p.listingType === 'auction' || p.listingType === 'both') && <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600"><Gavel className="w-3 h-3" />Auction</span>}
              </div>
              <p className="font-black text-sm flex-shrink-0 gradient-text">R{p.discountPrice || p.priceRange?.min || 0}</p>
              <span className={cn('text-[8px] font-bold px-2 py-1 rounded-full border flex-shrink-0', STATUS_STYLE[p.status] ?? STATUS_STYLE.pending)}>{p.status}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="Edit"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => setDeleteConfirm(p.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 mx-auto mb-4 flex items-center justify-center"><Trash2 className="w-6 h-6 text-red-500" /></div>
              <h3 className="text-lg font-black mb-2">Delete product?</h3>
              <p className="text-sm text-gray-400 mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 py-3 text-sm justify-center">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-3 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Add Product' : 'Edit Product'}</h2>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
              </div>

              <div className="overflow-y-auto p-6 space-y-5 flex-1">
                {error && <div className="p-3 bg-red-50 border border-red-100 rounded-2xl"><p className="text-xs font-bold text-red-600">{error}</p></div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Product Name</label>
                    <input value={editingProduct.name} onChange={e => setField('name', e.target.value)} className={inputCls} placeholder="e.g. Vintage Denim Jacket" />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={editingProduct.category} onChange={e => setField('category', e.target.value)} className={inputCls}>
                      <option value="">Select category…</option>
                      {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={editingProduct.description} onChange={e => setField('description', e.target.value)} rows={3} className={cn(inputCls, 'resize-none')} placeholder="Describe the item…" />
                </div>

                <div>
                  <label className={labelCls}>Photos (up to 3)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                  {imagePreviews.length > 0 ? (
                    <div className="flex gap-2 mt-1">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 flex-shrink-0">
                          <img src={src} className="w-full h-full object-cover rounded-2xl" alt="" />
                          <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      {imagePreviews.length < 3 && (
                        <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-gray-400 transition-colors"><Plus className="w-5 h-5" /></button>
                      )}
                    </div>
                  ) : editingProduct.imageUrl ? (
                    <div className="flex gap-2 mt-1">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <img src={editingProduct.imageUrl} className="w-full h-full object-cover rounded-2xl" alt="" referrerPolicy="no-referrer" />
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:border-gray-400 transition-colors text-xs font-bold gap-1">
                        <Camera className="w-5 h-5" />Replace
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} className="w-full h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-300 hover:border-gray-400 transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-bold">Upload photos</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Retail Price (R)</label>
                    <input type="number" value={editingProduct.retailPrice ?? ''} onChange={e => setField('retailPrice', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Markdown %</label>
                    <input type="number" value={editingProduct.markdownPercentage ?? 40} onChange={e => setField('markdownPercentage', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sale Price (R)</label>
                    <input type="number" value={editingProduct.discountPrice ?? ''} onChange={e => setField('discountPrice', Number(e.target.value))} className={cn(inputCls, 'bg-green-50 border-green-200')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Condition</label>
                    <select value={editingProduct.condition} onChange={e => setField('condition', e.target.value)} className={inputCls}>
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Total Stock</label>
                    <input type="number" value={editingProduct.stock ?? 1} onChange={e => setField('stock', Number(e.target.value))} className={inputCls} min={0} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={editingProduct.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Allocate Stock to Channels</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['store', 'auction', 'packs'] as const).map(ch => (
                      <div key={ch}>
                        <label className="section-label block mb-1 capitalize">{ch}</label>
                        <input type="number" min="0" max={editingProduct.stock ?? 1}
                          value={editingProduct.allocations?.[ch] ?? 0}
                          onChange={e => setField('allocations', { ...editingProduct.allocations || { store: 0, auction: 0, packs: 0 }, [ch]: Number(e.target.value) })}
                          className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Total: {(editingProduct.allocations?.store ?? 0) + (editingProduct.allocations?.auction ?? 0) + (editingProduct.allocations?.packs ?? 0)} / {editingProduct.stock ?? 1}
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Listing Channel</label>
                  <div className="flex gap-2">
                    {LISTING_TYPES.map(t => (
                      <button key={t} onClick={() => setField('listingType', t)} className={cn('filter-pill flex-1 justify-center capitalize', editingProduct.listingType === t && 'active')}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3 border-t border-gray-100">
                  <button onClick={closeModal} className="btn-secondary flex-1 py-3 text-sm justify-center">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 text-sm justify-center disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{savingMsg}</> : <><Save className="w-4 h-4" />{isNew ? 'Create Product' : 'Save Changes'}</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

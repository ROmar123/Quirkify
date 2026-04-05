import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { Product, ProductCondition } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Edit3, Trash2, Save, X, Plus, ShoppingBag, Camera, Loader2, Package, Gavel, CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PRODUCT_CATEGORIES } from '../../lib/categories';
import { uploadProductImage } from '../../services/storageService';
import { identifyProduct } from '../../services/gemini';

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
  status: 'approved',
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
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (err) => { handleFirestoreError(err, OperationType.GET, 'products'); setLoading(false); });
    return unsub;
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
    setEditingProduct({ ...p });
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

    // Validate required fields
    if (!editingProduct.name?.trim()) {
      setError('Product name is required');
      return;
    }
    if (!editingProduct.description?.trim()) {
      setError('Description is required');
      return;
    }
    if (!editingProduct.category?.trim()) {
      setError('Category is required');
      return;
    }
    if (!editingProduct.retailPrice || editingProduct.retailPrice <= 0) {
      setError('Retail price is required and must be greater than 0');
      return;
    }
    if (!editingProduct.stock || editingProduct.stock <= 0) {
      setError('Stock must be at least 1');
      return;
    }
    if (isNew && !editingProduct.imageUrl && imageFiles.length === 0) {
      setError('Product image is required');
      return;
    }

    // Validate allocations don't exceed total stock
    const totalAllocated = (editingProduct.allocations?.store || 0) + (editingProduct.allocations?.auction || 0) + (editingProduct.allocations?.packs || 0);
    if (totalAllocated > (editingProduct.stock || 0)) {
      setError(`Total allocated stock (${totalAllocated}) cannot exceed total stock (${editingProduct.stock})`);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      let imageUrl = editingProduct.imageUrl;
      let imageUrls: string[] = imageUrl ? [imageUrl] : [];
      let confidenceScore = editingProduct.confidenceScore ?? 0;

      // Pre-generate ID so storage path matches Firestore doc
      const productDocRef = isNew ? doc(collection(db, 'products')) : doc(db, 'products', editingProduct.id);

      // Upload new images if provided
      if (imageFiles.length > 0) {
        setSavingMsg('Uploading images…');
        imageUrls = await Promise.all(imageFiles.map(f => uploadProductImage(productDocRef.id, f)));
        imageUrl = imageUrls[0];

        // Run AI confidence on first image
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
      const payload = {
        name: editingProduct.name,
        description: editingProduct.description,
        category: editingProduct.category,
        imageUrl,
        imageUrls,
        confidenceScore,
        priceRange: { min: editingProduct.retailPrice || editingProduct.priceRange?.min, max: editingProduct.retailPrice || editingProduct.priceRange?.max },
        retailPrice: editingProduct.retailPrice,
        markdownPercentage: editingProduct.markdownPercentage,
        discountPrice: editingProduct.discountPrice,
        condition: editingProduct.condition,
        stock: editingProduct.stock,
        listingType: editingProduct.listingType,
        status: editingProduct.status,
      };
      if (isNew) {
        await setDoc(productDocRef, { ...payload, id: productDocRef.id, createdAt: serverTimestamp(), authorUid: auth.currentUser?.uid });
      } else {
        await updateDoc(productDocRef, payload);
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setSaving(false);
      setSavingMsg('Saving…');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      setDeleteConfirm(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  const setField = (key: string, value: any) => {
    if (!editingProduct) return;
    const updated = { ...editingProduct, [key]: value };
    // Auto-calculate discount price when retail or markdown changes
    if (key === 'retailPrice' || key === 'markdownPercentage') {
      const retail = key === 'retailPrice' ? value : updated.retailPrice;
      const pct = key === 'markdownPercentage' ? value : updated.markdownPercentage;
      updated.discountPrice = Math.round(retail * (1 - pct / 100));
      updated.priceRange = { min: updated.discountPrice, max: retail };
    }
    setEditingProduct(updated);
  };

  const inputCls = 'w-full p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl text-sm font-semibold text-purple-800 focus:outline-none focus:border-purple-400 transition-colors';
  const labelCls = 'text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black gradient-text">Product Listings</h1>
          <p className="text-purple-400 text-sm font-semibold">{products.length} total products</p>
        </div>
        <button onClick={openNew} className="btn-primary px-5 py-2.5 text-sm">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
            className={cn(inputCls, 'pl-10')} />
        </div>
        <div className="flex gap-2">
          {(['all', 'approved', 'pending', 'rejected'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-4 py-2 rounded-full text-xs font-bold capitalize border-2 transition-all',
                statusFilter === s ? 'text-white border-transparent' : 'bg-white text-purple-400 border-purple-100 hover:border-purple-300')}
              style={statusFilter === s ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-purple-50 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 rounded-3xl border border-purple-100 bg-purple-50">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-purple-200" />
          <p className="text-purple-400 font-bold text-sm">No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-2xl border border-purple-100 p-4 flex items-center gap-4 hover:shadow-md transition-all">
              {/* Image */}
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-purple-50">
                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" /> : <Package className="w-6 h-6 text-purple-200 m-auto mt-4" />}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate">{p.name || '(no name)'}</p>
                <p className="text-[9px] text-purple-400 font-semibold">{p.category} · {p.condition} · Stock: {p.stock ?? '—'}</p>
              </div>
              {/* Listing type */}
              <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                {(p.listingType === 'store' || p.listingType === 'both') && <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600"><ShoppingBag className="w-3 h-3" />Store</span>}
                {(p.listingType === 'auction' || p.listingType === 'both') && <span className="flex items-center gap-1 text-[8px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600"><Gavel className="w-3 h-3" />Auction</span>}
              </div>
              {/* Price */}
              <p className="font-black text-sm flex-shrink-0 gradient-text">R{p.discountPrice || p.priceRange?.min || 0}</p>
              {/* Status */}
              <span className={cn('text-[8px] font-bold px-2 py-1 rounded-full border flex-shrink-0', STATUS_STYLE[p.status] ?? STATUS_STYLE.pending)}>
                {p.status}
              </span>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-purple-50 text-purple-500 transition-colors" title="Edit">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteConfirm(p.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirm inline */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-black mb-2">Delete product?</h3>
              <p className="text-sm text-purple-400 mb-6">This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 py-3 text-sm justify-center">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3 rounded-full text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Create Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-purple-100">
                <h2 className="text-lg font-black gradient-text">{isNew ? 'Add Product' : 'Edit Product'}</h2>
                <button onClick={closeModal} className="p-2 rounded-full hover:bg-purple-50"><X className="w-5 h-5 text-purple-400" /></button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto p-6 space-y-5 flex-1">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-xs font-bold text-red-600">{error}</p>
                  </div>
                )}
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
                  <textarea value={editingProduct.description} onChange={e => setField('description', e.target.value)}
                    rows={3} className={cn(inputCls, 'resize-none')} placeholder="Describe the item…" />
                </div>

                <div>
                  <label className={labelCls}>Photos (up to 3)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={handleFileChange} />
                  {imagePreviews.length > 0 ? (
                    <div className="flex gap-2 mt-1">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 flex-shrink-0">
                          <img src={src} className="w-full h-full object-cover rounded-2xl" alt="" />
                          <button onClick={() => removeImage(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {imagePreviews.length < 3 && (
                        <button onClick={() => fileInputRef.current?.click()}
                          className="w-20 h-20 rounded-2xl border-2 border-dashed border-purple-200 flex items-center justify-center text-purple-300 hover:border-purple-400 transition-colors">
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ) : editingProduct.imageUrl ? (
                    <div className="flex gap-2 mt-1">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <img src={editingProduct.imageUrl} className="w-full h-full object-cover rounded-2xl" alt="" referrerPolicy="no-referrer" />
                      </div>
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-2xl border-2 border-dashed border-purple-200 flex flex-col items-center justify-center text-purple-300 hover:border-purple-400 transition-colors text-xs font-bold gap-1">
                        <Camera className="w-5 h-5" />Replace
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 rounded-2xl border-2 border-dashed border-purple-200 flex flex-col items-center justify-center gap-2 text-purple-300 hover:border-purple-400 transition-colors">
                      <Camera className="w-6 h-6" />
                      <span className="text-xs font-bold">Upload photos</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Retail Price (R)</label>
                    <input type="number" value={editingProduct.retailPrice || ''} onChange={e => setField('retailPrice', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Markdown %</label>
                    <input type="number" value={editingProduct.markdownPercentage ?? 40} onChange={e => setField('markdownPercentage', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sale Price (R)</label>
                    <input type="number" value={editingProduct.discountPrice || ''} onChange={e => setField('discountPrice', Number(e.target.value))} className={cn(inputCls, 'bg-green-50 border-green-200')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>Condition</label>
                    <select value={editingProduct.condition} onChange={e => setField('condition', e.target.value)} className={inputCls}>
                      {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Stock</label>
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
                  <label className={labelCls}>Listing Channel</label>
                  <div className="flex gap-2">
                    {LISTING_TYPES.map(t => (
                      <button key={t} onClick={() => setField('listingType', t)}
                        className={cn('flex-1 py-2.5 rounded-2xl text-xs font-bold capitalize border-2 transition-all',
                          editingProduct.listingType === t ? 'text-white border-transparent' : 'bg-white text-purple-400 border-purple-100')}
                        style={editingProduct.listingType === t ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sticky save footer inside scroll area */}
                <div className="sticky bottom-0 bg-white pt-4 pb-2 flex gap-3 border-t border-purple-100 -mx-6 px-6">
                  <button onClick={closeModal} className="btn-secondary flex-1 py-3 text-sm justify-center">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 text-sm justify-center disabled:opacity-50">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{savingMsg}</> : <><Save className="w-4 h-4" />{isNew ? 'Create Product' : 'Save Changes'}</>}
                  </button>
                </div>
              </div>

              {/* Modal footer — desktop fallback (hidden on mobile since sticky above handles it) */}
              <div className="hidden sm:flex p-6 border-t border-purple-100 gap-3">
                <button onClick={closeModal} className="btn-secondary flex-1 py-3 text-sm justify-center">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 text-sm justify-center disabled:opacity-50">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{savingMsg}</> : <><Save className="w-4 h-4" />{isNew ? 'Create Product' : 'Save Changes'}</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from 'react';
import { Product } from '../../../types';
import { createStoreListing } from '../../../services/storeListingService';
import { X, ShoppingBag, AlertCircle } from 'lucide-react';

interface Props {
  product: Product;
  onPublished: () => void;
  onClose: () => void;
}

export default function PublishToStoreModal({ product, onPublished, onClose }: Props) {
  const defaultSelling = product.discountPrice && product.discountPrice > 0
    ? product.discountPrice
    : Math.round((product.retailPrice || 0) * 0.6 * 100) / 100;

  const [sellingPrice, setSellingPrice] = useState(defaultSelling);
  const [quantity, setQuantity] = useState(product.stock || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discountPct = product.retailPrice && product.retailPrice > 0
    ? Math.round(((product.retailPrice - sellingPrice) / product.retailPrice) * 100)
    : 0;

  const handlePublish = async () => {
    if (sellingPrice <= 0) { setError('Selling price must be greater than 0'); return; }
    if (quantity <= 0) { setError('Quantity must be greater than 0'); return; }
    if (quantity > (product.stock || 0)) { setError(`Cannot exceed total stock (${product.stock})`); return; }
    setError(null);
    setSaving(true);
    try {
      await createStoreListing({
        productId: product.id,
        title: product.name,
        description: product.description,
        images: product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [],
        retailPrice: product.retailPrice || 0,
        sellingPrice,
        quantityTotal: quantity,
        publish: true,
      });
      onPublished();
    } catch (err: any) {
      setError(err.message || 'Failed to publish listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Publish to Store</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg" />
            )}
            <div>
              <p className="font-medium text-gray-900 text-sm">{product.name}</p>
              <p className="text-xs text-gray-400">{product.category} · {product.condition} · {product.stock} in stock</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Retail Price (R)
              </label>
              <div className="input bg-gray-50 text-gray-500 text-sm flex items-center">
                R{(product.retailPrice || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Selling Price (R)
              </label>
              <input
                type="number"
                value={sellingPrice}
                min={1}
                step={0.01}
                onChange={e => setSellingPrice(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          {discountPct > 0 && (
            <p className="text-xs text-green-700 font-semibold bg-green-50 px-3 py-1.5 rounded-lg inline-block">
              -{discountPct}% off retail
            </p>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Quantity to list (max {product.stock})
            </label>
            <input
              type="number"
              value={quantity}
              min={1}
              max={product.stock || 1}
              onChange={e => setQuantity(Number(e.target.value))}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShoppingBag className="w-4 h-4" />
            {saving ? 'Publishing…' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

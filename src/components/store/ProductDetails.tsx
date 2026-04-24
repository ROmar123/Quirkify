import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { getProduct } from '../../services/catalogService';
import { useCart } from '../../context/CartContext';
import { availableUnits, currency, labelCondition, totalReservedUnits } from '../../lib/quirkify';
import type { Product } from '../../types';

export default function ProductDetails() {
  const { productId = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getProduct(productId)
      .then(setProduct)
      .catch((loadError) => {
        setProduct(null);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load product');
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const storeAvailable = useMemo(() => (product ? availableUnits(product, 'store') : 0), [product]);
  const auctionAllocation = useMemo(() => Number(product?.inventory?.allocated?.auction ?? product?.allocations?.auction ?? 0), [product]);
  const packAllocation = useMemo(() => Number(product?.inventory?.allocated?.packs ?? product?.allocations?.packs ?? 0), [product]);

  if (loading) {
    return <div className="px-4 py-12 text-center text-white/70">Loading product...</div>;
  }

  if (!product) {
    return (
      <section className="bg-[linear-gradient(180deg,#091019,#101823_25%,#f4efe6_25%,#f4efe6)] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-black/8 bg-white p-8 text-center shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#725d34]">Catalogue</p>
          <h1 className="mt-4 text-3xl font-black text-[#10151e]">Product not found</h1>
          <p className="mt-4 text-sm leading-6 text-[#10151e]/65">
            {error
              ? `The product could not be loaded from the catalogue source of truth. ${error}`
              : 'This listing is no longer live. Return to the store to continue browsing active items.'}
          </p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#10151e] px-5 py-3 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[linear-gradient(180deg,#091019,#101823_25%,#efe8dc_25%,#efe8dc)] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" /> Back to store
        </Link>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[2rem] bg-[#e9e2d4]">
              {product.media?.[0]?.url ? <img src={product.media[0].url} alt={product.title} className="h-full w-full object-cover" /> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: 'Store-ready units', value: String(storeAvailable) },
                { label: 'Auction allocation', value: String(auctionAllocation) },
                { label: 'Pack allocation', value: String(packAllocation) },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.4rem] border border-black/8 bg-white p-4 shadow-[0_10px_25px_rgba(15,21,30,0.06)]">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#725d34]">{item.label}</p>
                  <p className="mt-3 text-3xl font-black text-[#10151e]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f8f4ec] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#725d34]">
                {product.category}
              </span>
              <span className="rounded-full bg-[#eef5f1] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#35664a]">
                {labelCondition(product.condition)}
              </span>
              <span className="rounded-full bg-[#edf2ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#37558f]">
                {product.status}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight">{product.title}</h1>
            <p className="mt-4 text-base leading-7 text-[#10151e]/68">{product.description}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-[#f8f4ec] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-[#725d34]">Buy now</p>
                <p className="mt-2 text-2xl font-black">{currency(product.pricing?.salePrice || 0)}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[#f8f4ec] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-[#725d34]">Auction range</p>
                <p className="mt-2 text-2xl font-black">
                  {currency(product.pricing?.auctionStartPrice || product.pricing?.salePrice || 0)}
                  {' - '}
                  {currency(product.priceRange?.max || product.pricing?.listPrice || 0)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { title: 'AI reviewed', copy: 'Listing data has been checked before publication.', icon: Sparkles },
                { title: 'Secure checkout', copy: 'Orders and payments reconcile into the same commerce record.', icon: ShieldCheck },
                { title: 'Channel-aware stock', copy: 'Store, auction, and pack allocations stay visible.', icon: ShoppingBag },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[1.35rem] border border-black/8 bg-white p-4">
                    <Icon className="h-4 w-4 text-[#725d34]" />
                    <p className="mt-3 text-sm font-black text-[#10151e]">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#10151e]/62">{item.copy}</p>
                  </div>
                );
              })}
            </div>

            {product.tags?.length ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[#10151e]/70">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => addToCart(product)}
                disabled={storeAvailable <= 0}
                className="rounded-full bg-[#10151e] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {storeAvailable > 0 ? 'Add to cart' : 'Awaiting stock'}
              </button>
              <Link to="/auctions" className="rounded-full border border-black/10 px-5 py-3 text-sm font-bold text-[#10151e]">
                View auctions
              </Link>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-black/8 bg-[#f8f4ec] p-5">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-[#725d34]" />
                <p className="text-sm font-black">Inventory integrity</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#725d34]">On hand</p>
                  <p className="mt-1 text-lg font-black text-[#10151e]">{product.inventory?.onHand ?? product.stock ?? 0} units</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#725d34]">Reserved across channels</p>
                  <p className="mt-1 text-lg font-black text-[#10151e]">{totalReservedUnits(product)} units</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#725d34]">Store allocation</p>
                  <p className="mt-1 text-lg font-black text-[#10151e]">{product.inventory?.allocated?.store ?? 0} units</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#725d34]">Auction allocation</p>
                  <p className="mt-1 text-lg font-black text-[#10151e]">{auctionAllocation} units</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

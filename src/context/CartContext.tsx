import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Pack, Product } from '../types';
import { availableUnits } from '../lib/quirkify';

interface CartContextValue {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => { ok: boolean; message?: string };
  addPackToCart: (pack: Pack, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'quirkify-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    addToCart(product, quantity = 1) {
      const maxStock = availableUnits(product, 'store');
      const title = product.title || product.name || 'Product';
      const image = product.media?.[0]?.url || product.imageUrl || product.imageUrls?.[0];
      const unitPrice = Number(
        product.pricing?.salePrice ??
        product.discountPrice ??
        product.priceRange?.min ??
        product.retailPrice ??
        0
      );
      setItems((current) => {
        const existing = current.find((item) => item.productId === product.id && item.kind === 'product');
        if (existing) {
          const capped = Math.min(existing.quantity + quantity, maxStock > 0 ? maxStock : existing.quantity + quantity);
          return current.map((item) =>
            item.productId === product.id && item.kind === 'product'
              ? { ...item, quantity: capped, maxStock }
              : item
          );
        }
        const cappedQty = maxStock > 0 ? Math.min(quantity, maxStock) : quantity;
        return [
          ...current,
          {
            kind: 'product',
            productId: product.id,
            id: product.id,
            title,
            name: title,
            category: product.category,
            image,
            imageUrl: image,
            unitPrice,
            retailPrice: product.retailPrice ?? unitPrice,
            priceRange: product.priceRange,
            quantity: cappedQty,
            maxStock,
          },
        ];
      });
      return { ok: true };
    },
    addPackToCart(pack, quantity = 1) {
      setItems((current) => {
        const existing = current.find((item) => item.productId === pack.id && item.kind === 'pack');
        if (existing) {
          return current.map((item) =>
            item.productId === pack.id && item.kind === 'pack'
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [
          ...current,
          {
            kind: 'pack',
            productId: pack.id,
            title: pack.title,
            image: pack.heroImage,
            unitPrice: pack.price,
            quantity,
          },
        ];
      });
    },
    removeFromCart(productId) {
      setItems((current) => current.filter((item) => item.productId !== productId));
    },
    updateQuantity(productId, quantity) {
      setItems((current) =>
        current
          .map((item) => (item.productId === productId ? { ...item, quantity } : item))
          .filter((item) => item.quantity > 0)
      );
    },
    clearCart() {
      setItems([]);
    },
    total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => { ok: boolean; message?: string };
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'quirkify_cart';
const MAX_QUANTITY_PER_ITEM = 20;
const MAX_CART_ITEMS = 50;

function getAvailableStock(product: Product): number {
  return product.allocations?.store ?? product.stock ?? 99;
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  const addToCart = (product: Product, quantity: number = 1): { ok: boolean; message?: string } => {
    const available = getAvailableStock(product);

    if (available <= 0) {
      return { ok: false, message: `${product.name} is out of stock` };
    }

    let message: string | undefined;

    setItems(prev => {
      if (prev.length >= MAX_CART_ITEMS && !prev.find(i => i.id === product.id)) {
        return prev;
      }

      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        const newQty = Math.min(
          existing.quantity + quantity,
          available,
          MAX_QUANTITY_PER_ITEM
        );
        if (newQty === existing.quantity) {
          message = `Max available quantity (${available}) already in cart`;
        } else if (existing.quantity + quantity > available) {
          message = `Only ${available} available — quantity capped`;
        }
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      }

      const capped = Math.min(quantity, available, MAX_QUANTITY_PER_ITEM);
      return [...prev, { ...product, quantity: capped }];
    });

    if (items.length >= MAX_CART_ITEMS && !items.find(i => i.id === product.id)) {
      return { ok: false, message: 'Cart is full (50 item limit)' };
    }

    return { ok: true, message };
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== productId) return item;
      const available = getAvailableStock(item);
      const capped = Math.min(Math.max(0, quantity), available, MAX_QUANTITY_PER_ITEM);
      return { ...item, quantity: capped };
    }).filter(item => item.quantity > 0));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + ((item.discountPrice ?? item.retailPrice ?? 0) * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

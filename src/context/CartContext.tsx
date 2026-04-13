import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { secureStorage } from '../lib/security';

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  isLoaded: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'quirkify_cart_v1';
const MAX_CART_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 20;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = secureStorage.get(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Validate and sanitize loaded items
          const validItems = parsed.filter(item => 
            item && 
            item.id && 
            item.name && 
            typeof item.priceRange?.min === 'number' &&
            item.quantity > 0 &&
            item.quantity <= MAX_QUANTITY_PER_ITEM
          ).slice(0, MAX_CART_ITEMS);
          setItems(validItems);
        }
      }
    } catch (e) {
      console.error('[Cart] Failed to load cart from storage:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isLoaded) {
      try {
        secureStorage.set(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error('[Cart] Failed to save cart to storage:', e);
      }
    }
  }, [items, isLoaded]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    const safeQuantity = Math.min(Math.max(1, quantity), MAX_QUANTITY_PER_ITEM);
    
    setItems(prev => {
      // Check cart limit
      if (prev.length >= MAX_CART_ITEMS && !prev.find(item => item.id === product.id)) {
        console.warn('[Cart] Maximum cart items reached');
        return prev;
      }
      
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        const newQuantity = Math.min(existing.quantity + safeQuantity, MAX_QUANTITY_PER_ITEM);
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: newQuantity } : item
        );
      }
      return [...prev, { ...product, quantity: safeQuantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const safeQuantity = Math.min(Math.max(0, quantity), MAX_QUANTITY_PER_ITEM);
    setItems(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity: safeQuantity } : item
    ).filter(item => item.quantity > 0));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    secureStorage.remove(CART_STORAGE_KEY);
  }, []);

  const total = items.reduce((sum, item) => sum + (item.priceRange.min * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total, isLoaded }}>
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

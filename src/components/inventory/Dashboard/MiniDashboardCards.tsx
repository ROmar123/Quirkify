import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../firebase';
import { Product, Auction, Pack } from '../../../types';
import { motion } from 'motion/react';
import { Package, Gavel, Gift, AlertCircle, TrendingUp, Clock, Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface MiniDashboardCardsProps {
  onSelectSection: (section: 'add-product' | 'products' | 'auctions' | 'packs') => void;
}

export default function MiniDashboardCards({ onSelectSection }: MiniDashboardCardsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProducts: any, unsubAuctions: any, unsubPacks: any;

    try {
      // Fetch approved products
      unsubProducts = onSnapshot(
        query(collection(db, 'products'), where('status', '==', 'approved')),
        (snap) => {
          setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'products');
          setLoading(false);
        }
      );

      // Fetch active auctions
      unsubAuctions = onSnapshot(
        query(collection(db, 'auctions'), where('status', '==', 'active')),
        (snap) => {
          setAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Auction)));
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'auctions');
          setLoading(false);
        }
      );

      // Fetch packs
      unsubPacks = onSnapshot(
        collection(db, 'packs'),
        (snap) => {
          setPacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pack)));
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'packs');
          setLoading(false);
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'inventory');
      setLoading(false);
    }

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubAuctions) unsubAuctions();
      if (unsubPacks) unsubPacks();
    };
  }, []);

  // Calculate metrics
  const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);
  const totalProductValue = products.reduce((sum, p) => sum + ((p.discountPrice || 0) * (p.stock || 0)), 0);
  const auctionValue = auctions.reduce((sum, a) => sum + (a.currentBid || a.startPrice), 0);
  const auctionEnding = auctions.filter(a => {
    const timeLeft = new Date(a.endTime).getTime() - Date.now();
    return timeLeft > 0 && timeLeft < 3600000; // Less than 1 hour
  }).length;

  const cards = [
    {
      id: 'add-product',
      label: 'Add Product',
      icon: Plus,
      color: 'from-green-500 to-emerald-600',
      stats: [
        { label: 'Action', value: 'New' },
        { label: 'Method', value: 'AI or Manual' },
        { label: 'Status', value: 'Intake' }
      ]
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      color: 'from-purple-500 to-indigo-600',
      stats: [
        { label: 'Total Items', value: loading ? '—' : products.length },
        { label: 'Total Value', value: loading ? '—' : `R${totalProductValue.toLocaleString()}` },
        { label: 'Low Stock', value: loading ? '—' : lowStockProducts.length, alert: lowStockProducts.length > 0 }
      ]
    },
    {
      id: 'auctions',
      label: 'Auctions',
      icon: Gavel,
      color: 'from-amber-500 to-orange-600',
      stats: [
        { label: 'Active Now', value: loading ? '—' : auctions.length },
        { label: 'Bid Value', value: loading ? '—' : `R${auctionValue.toLocaleString()}` },
        { label: 'Ending Soon', value: loading ? '—' : auctionEnding, alert: auctionEnding > 0 }
      ]
    },
    {
      id: 'packs',
      label: 'Packs',
      icon: Gift,
      color: 'from-pink-500 to-rose-600',
      stats: [
        { label: 'Available', value: loading ? '—' : packs.length },
        { label: 'Products Linked', value: loading ? '—' : packs.reduce((sum, p) => sum + (p.linkedProductIds?.length || 0), 0) },
        { label: 'Total Revenue', value: loading ? '—' : `R${packs.reduce((sum, p) => sum + ((p.price || 0) * 1), 0).toLocaleString()}` }
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Low Stock Alert - if any products are low */}
      {!loading && lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border-2 border-red-200 rounded-3xl p-4 sm:p-5 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-red-900 text-sm sm:text-base">Low Stock Alert</h3>
            <p className="text-red-700 text-xs sm:text-sm font-semibold mt-1">
              {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} with 5 or fewer items. Manage now.
            </p>
          </div>
        </motion.div>
      )}

      {/* Mini Dashboard Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 auto-rows-max">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(168, 85, 247, 0.15)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectSection(card.id as 'add-product' | 'products' | 'auctions' | 'packs')}
              className="bg-white rounded-3xl border-2 border-purple-100 overflow-hidden hover:border-purple-300 transition-all group text-left shadow-sm"
            >
              {/* Gradient top bar */}
              <div className={cn('h-1.5 bg-gradient-to-r', card.color)} />

              {/* Content */}
              <div className="p-5 sm:p-6 space-y-4">
                {/* Header: Icon + Label */}
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0',
                    `bg-gradient-to-br ${card.color}`
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-purple-900 flex-1">{card.label}</h3>
                </div>

                {/* Stats Grid */}
                <div className="space-y-3 border-t border-purple-100 pt-4">
                  {card.stats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">{stat.label}</p>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-lg font-black',
                          stat.alert ? 'text-red-600' : 'text-purple-900'
                        )}>
                          {stat.value}
                        </p>
                        {stat.alert && (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div className="inline-flex items-center text-purple-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                  View Details →
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

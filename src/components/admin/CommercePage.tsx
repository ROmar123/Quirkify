import { useState, lazy, Suspense, Component, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Test with minimal version first
const OrderManager = lazy(() => import('./OrderManagerTest'));
const AuctionManager = lazy(() => import('./AuctionManager').catch(e => { console.error('Failed to load AuctionManager:', e); throw e; }));
const PackManager = lazy(() => import('./PackManager').catch(e => { console.error('Failed to load PackManager:', e); throw e; }));

type Tab = 'orders' | 'auctions' | 'packs';

// Error Boundary
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Error details:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white p-8">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-8">
              <h2 className="text-xl font-black text-red-600 mb-4">⚠️ Error Loading Commerce</h2>
              <p className="text-red-500 font-bold mb-4">Something went wrong:</p>
              <pre className="bg-red-100 p-4 rounded-xl text-xs overflow-auto text-red-700 mb-6">
                {this.state.error?.message || 'Unknown error'}
              </pre>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                className="px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function CommercePage() {
  const { pathname } = useLocation();
  const initial: Tab = pathname === '/admin/auctions' ? 'auctions' : pathname === '/admin/packs' ? 'packs' : 'orders';
  const [tab, setTab] = useState<Tab>(initial);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orders',   label: 'Orders' },
    { id: 'auctions', label: 'Auctions' },
    { id: 'packs',    label: 'Mystery Packs' },
  ];

  const tabClassActive = 'px-6 py-2 rounded-full text-sm font-black text-white shadow-md';
  const tabClassInactive = 'px-6 py-2 rounded-full text-sm font-black bg-purple-50 text-purple-400 hover:bg-purple-100 border border-purple-100 transition-all';

  console.log('[Commerce] Rendering, current tab:', tab);

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-white">
      {/* Header/Tabs */}
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-purple-900 mb-4">Commerce</h1>
          <div className="flex gap-3">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => { console.log('[Commerce] Switching to tab:', t.id); setTab(t.id); }}
                className={tab === t.id ? tabClassActive : tabClassInactive}
                style={tab === t.id ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin mx-auto mb-4" />
              <p className="text-sm font-bold text-purple-400">Loading...</p>
            </div>
          </div>
        }>
          <div key={tab}>
            {tab === 'orders' && (
              <ErrorBoundary>
                <h2 className="text-lg font-bold mb-4 text-purple-900">Orders Management</h2>
                <OrderManager />
              </ErrorBoundary>
            )}
            {tab === 'auctions' && (
              <ErrorBoundary>
                <h2 className="text-lg font-bold mb-4 text-purple-900">Auctions Management</h2>
                <AuctionManager />
              </ErrorBoundary>
            )}
            {tab === 'packs' && (
              <ErrorBoundary>
                <h2 className="text-lg font-bold mb-4 text-purple-900">Mystery Packs Management</h2>
                <PackManager />
              </ErrorBoundary>
            )}
          </div>
        </Suspense>
      </div>
    </div>
    </ErrorBoundary>
  );
}

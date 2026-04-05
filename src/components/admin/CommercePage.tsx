import { Suspense } from 'react';
import OrderManager from './OrderManager';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
    </div>
  );
}

export default function CommercePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-purple-900 mb-4">Commerce</h1>
          <p className="text-xs text-purple-400">Orders Management</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<LoadingFallback />}>
          <OrderManager />
        </Suspense>
      </div>
    </div>
  );
}

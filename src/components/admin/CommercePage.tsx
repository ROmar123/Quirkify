import OrderManager from './OrderManager';

export default function CommercePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Commerce</h1>
              <p className="text-gray-400 text-xs mt-0.5">Payment, fulfilment & delivery ops</p>
            </div>
          </div>
        </div>
      </div>
      <OrderManager />
    </div>
  );
}

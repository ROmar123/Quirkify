import OrderManager from './OrderManager';

export default function CommercePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-md border-b-2 border-purple-100 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-black text-purple-900 mb-4">Commerce - Orders Only</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <OrderManager />
      </div>
    </div>
  );
}

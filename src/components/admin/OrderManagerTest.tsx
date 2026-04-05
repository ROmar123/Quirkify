export default function OrderManagerTest() {
  console.log('[OrderManagerTest] Rendering');
  return (
    <div className="space-y-4">
      <div className="bg-purple-50 rounded-3xl border-2 border-purple-100 p-6">
        <p className="text-purple-900 font-bold">✅ Orders Manager Loaded</p>
        <p className="text-purple-400 text-sm mt-2">This is a test version without Firestore</p>
      </div>
      <div className="bg-white rounded-3xl border-2 border-purple-100 p-6">
        <h3 className="font-bold text-purple-900 mb-3">Test Order</h3>
        <p className="text-sm text-purple-600">Order #12345 - R1,250.00 - Processing</p>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function ReturnsPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-32 md:pb-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-600 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </Link>

      <div className="rounded-[2rem] border border-purple-100 bg-white p-8 shadow-sm space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">Legal</p>
          <h1 className="mt-2 text-4xl font-black text-purple-900">Returns &amp; Refunds Policy</h1>
          <p className="mt-3 text-sm text-purple-400 font-semibold">Last updated: April 2025</p>
        </div>

        <p className="text-sm leading-7 text-purple-600">
          Your rights as a consumer are protected under the Consumer Protection Act (CPA) of South Africa. This policy explains how we handle returns and refunds on Quirkify.
        </p>

        {[
          {
            title: '1. Eligibility for Returns',
            body: 'You may return an item within 7 days of receipt if: the item is materially different from its listing description; the item arrived damaged or defective; you received the wrong item. Items must be returned in their original condition with all original packaging and accessories.',
          },
          {
            title: '2. Items Not Eligible for Return',
            body: 'The following items are not eligible for return unless defective: items marked "Final Sale"; auction-won items (unless materially misrepresented); digital products or services; items that have been used, altered, or damaged after delivery.',
          },
          {
            title: '3. How to Initiate a Return',
            body: 'To initiate a return, contact us through the Platform within 7 days of receiving your order. Include your order number, a description of the issue, and photographs where applicable. We will respond within 2 business days with return instructions.',
          },
          {
            title: '4. Return Shipping',
            body: 'If the return is due to our error (wrong item, defective product), we will cover the return shipping cost via The Courier Guy. For change-of-mind returns where eligible, the customer is responsible for return shipping costs.',
          },
          {
            title: '5. Refunds',
            body: 'Once we receive and inspect the returned item, we will process your refund within 5–7 business days. Refunds will be issued via the original payment method. Shipping costs are non-refundable unless the return is due to our error.',
          },
          {
            title: '6. Damaged or Defective Items',
            body: 'If your item arrives damaged, photograph it immediately and contact us within 48 hours of delivery. We will arrange a replacement or full refund at no additional cost to you. Do not discard any packaging, as it may be required for the courier\'s claims process.',
          },
          {
            title: '7. Auction Purchases',
            body: 'All auction sales are final unless the item was materially misrepresented in the listing. If you believe an auction item was misrepresented, contact us within 48 hours of receipt with supporting evidence.',
          },
          {
            title: '8. Consumer Protection Act',
            body: 'Nothing in this policy limits your rights under the Consumer Protection Act 68 of 2008. You have the right to receive goods that are safe, of good quality, and match their description. If you believe your CPA rights have been violated, you may contact the National Consumer Commission.',
          },
          {
            title: '9. Contact',
            body: 'For all returns and refund enquiries, please contact us through the Platform with your order number. Our team operates Monday–Friday during business hours and will assist you as promptly as possible.',
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <h2 className="text-base font-black text-purple-900 mb-2">{title}</h2>
            <p className="text-sm leading-7 text-purple-600">{body}</p>
          </div>
        ))}

        <div className="pt-4 border-t border-purple-100 flex flex-wrap gap-4 text-xs font-bold text-purple-400">
          <Link to="/terms" className="hover:text-purple-600">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-purple-600">Privacy Policy</Link>
          <Link to="/" className="hover:text-purple-600">Back to Store</Link>
        </div>
      </div>
    </div>
  );
}

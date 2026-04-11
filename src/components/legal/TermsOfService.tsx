import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-32 md:pb-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-600 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </Link>

      <div className="rounded-[2rem] border border-purple-100 bg-white p-8 shadow-sm space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">Legal</p>
          <h1 className="mt-2 text-4xl font-black text-purple-900">Terms of Service</h1>
          <p className="mt-3 text-sm text-purple-400 font-semibold">Last updated: April 2025</p>
        </div>

        {[
          {
            title: '1. Acceptance of Terms',
            body: 'By accessing or using Quirkify ("the Platform"), you agree to be bound by these Terms of Service and all applicable South African laws and regulations. If you do not agree with any part of these terms, you may not use the Platform.',
          },
          {
            title: '2. Eligibility',
            body: 'You must be at least 18 years of age to use this Platform or have the consent of a parent or legal guardian. By using the Platform, you represent that you meet this requirement.',
          },
          {
            title: '3. Account Registration',
            body: 'You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorised use.',
          },
          {
            title: '4. Products and Listings',
            body: 'All products listed on Quirkify are subject to availability. We reserve the right to limit quantities and to reject or cancel orders at our discretion. Product images are representative; minor variations may occur. All prices are displayed in South African Rand (ZAR) and are inclusive of VAT where applicable.',
          },
          {
            title: '5. Auctions',
            body: 'Auction bids are legally binding offers to purchase. The highest valid bid at auction close constitutes a binding contract. Auction winners will be contacted within 24 hours. Failure to complete payment may result in account suspension.',
          },
          {
            title: '6. Payments',
            body: 'Payments are processed securely via Yoco, a registered South African payment service provider. By completing a purchase, you authorise Quirkify to charge the specified amount. All transactions are subject to Yoco\'s terms and conditions.',
          },
          {
            title: '7. Shipping and Delivery',
            body: 'We use The Courier Guy for all deliveries within South Africa. Estimated delivery times are provided as a guide only and may vary based on location and courier conditions. Risk of loss transfers to you upon delivery.',
          },
          {
            title: '8. Prohibited Conduct',
            body: 'You agree not to: use the Platform for any unlawful purpose; submit false or misleading information; attempt to circumvent any security measures; resell or redistribute Platform content without written consent; or engage in any conduct that disrupts or interferes with the Platform.',
          },
          {
            title: '9. Intellectual Property',
            body: 'All content on the Platform, including logos, product descriptions, and AI-generated analyses, is the property of Quirkify or its licensors and is protected by applicable intellectual property laws. You may not reproduce or distribute any content without express written permission.',
          },
          {
            title: '10. Limitation of Liability',
            body: 'To the maximum extent permitted by South African law, Quirkify shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the amount paid for the specific transaction giving rise to the claim.',
          },
          {
            title: '11. Governing Law',
            body: 'These Terms shall be governed by and construed in accordance with the laws of the Republic of South Africa. Any disputes shall be subject to the exclusive jurisdiction of the courts of South Africa.',
          },
          {
            title: '12. Changes to Terms',
            body: 'We reserve the right to modify these Terms at any time. Changes will be effective upon posting to the Platform. Continued use of the Platform after changes constitutes acceptance of the revised Terms.',
          },
          {
            title: '13. Contact',
            body: 'For questions about these Terms, please contact us via the Platform. We aim to respond within 2 business days.',
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <h2 className="text-base font-black text-purple-900 mb-2">{title}</h2>
            <p className="text-sm leading-7 text-purple-600">{body}</p>
          </div>
        ))}

        <div className="pt-4 border-t border-purple-100 flex flex-wrap gap-4 text-xs font-bold text-purple-400">
          <Link to="/privacy" className="hover:text-purple-600">Privacy Policy</Link>
          <Link to="/returns" className="hover:text-purple-600">Returns Policy</Link>
          <Link to="/" className="hover:text-purple-600">Back to Store</Link>
        </div>
      </div>
    </div>
  );
}

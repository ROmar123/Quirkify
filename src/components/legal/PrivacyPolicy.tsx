import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-32 md:pb-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-purple-400 hover:text-purple-600 mb-8">
        <ArrowLeft className="w-4 h-4" />
        Back to Store
      </Link>

      <div className="rounded-[2rem] border border-purple-100 bg-white p-8 shadow-sm space-y-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">Legal</p>
          <h1 className="mt-2 text-4xl font-black text-purple-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-purple-400 font-semibold">Last updated: April 2025</p>
        </div>

        <p className="text-sm leading-7 text-purple-600">
          Quirkify is committed to protecting your personal information in accordance with the Protection of Personal Information Act (POPIA) and other applicable South African data protection laws.
        </p>

        {[
          {
            title: '1. Information We Collect',
            body: 'We collect information you provide directly (name, email address, delivery address, phone number) when you register or place an order. We also collect transactional data (order history, payment references) and usage data (pages visited, search queries) to improve the Platform.',
          },
          {
            title: '2. How We Use Your Information',
            body: 'We use your information to: process and fulfil orders; communicate order status and updates; personalise your experience and product recommendations; comply with legal obligations; and improve the Platform through analytics. We do not sell your personal information to third parties.',
          },
          {
            title: '3. Legal Basis for Processing (POPIA)',
            body: 'We process your personal information on the following grounds: performance of a contract (fulfilling your order); legitimate interests (fraud prevention, improving services); legal obligation (tax records, compliance); and consent where required (marketing communications).',
          },
          {
            title: '4. Sharing of Information',
            body: 'We share your information only with trusted service providers necessary to operate the Platform: Yoco (payment processing), The Courier Guy (delivery), Google Firebase (authentication), Supabase (database), and Google Gemini (AI product verification). All processors are contractually bound to protect your data.',
          },
          {
            title: '5. Data Retention',
            body: 'We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Order records are retained for a minimum of 5 years for tax and accounting purposes. You may request deletion of your account at any time, subject to retention obligations.',
          },
          {
            title: '6. Your Rights (POPIA)',
            body: 'Under POPIA you have the right to: access your personal information held by us; request correction of inaccurate information; object to processing; request deletion where legally permissible; and lodge a complaint with the Information Regulator of South Africa.',
          },
          {
            title: '7. Security',
            body: 'We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, disclosure, alteration, or destruction. Payments are processed via PCI-DSS compliant systems. However, no system is entirely secure and we cannot guarantee absolute security.',
          },
          {
            title: '8. Cookies',
            body: 'We use essential cookies required for the Platform to function. We do not use tracking or advertising cookies without your consent. You can control cookie settings through your browser.',
          },
          {
            title: '9. Children',
            body: 'The Platform is not directed at children under 18. We do not knowingly collect personal information from minors without verifiable parental consent.',
          },
          {
            title: '10. Changes to This Policy',
            body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a prominent notice on the Platform. Continued use after changes constitutes acceptance.',
          },
          {
            title: '11. Contact & Complaints',
            body: 'For privacy-related enquiries or to exercise your rights, contact us through the Platform. If you are not satisfied with our response, you may contact the Information Regulator of South Africa at inforeg.org.za.',
          },
        ].map(({ title, body }) => (
          <div key={title}>
            <h2 className="text-base font-black text-purple-900 mb-2">{title}</h2>
            <p className="text-sm leading-7 text-purple-600">{body}</p>
          </div>
        ))}

        <div className="pt-4 border-t border-purple-100 flex flex-wrap gap-4 text-xs font-bold text-purple-400">
          <Link to="/terms" className="hover:text-purple-600">Terms of Service</Link>
          <Link to="/returns" className="hover:text-purple-600">Returns Policy</Link>
          <Link to="/" className="hover:text-purple-600">Back to Store</Link>
        </div>
      </div>
    </div>
  );
}

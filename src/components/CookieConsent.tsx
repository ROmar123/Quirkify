import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie } from 'lucide-react';
import { getConsent, setConsent } from '../lib/consent';

/**
 * POPIA-aligned tracking-consent banner.
 *
 * Renders the first time a user lands without a stored choice. Choosing
 * either option persists the decision in localStorage. The Sentry init in
 * `lib/sentry.ts` reads that value on the next page load to decide whether
 * to enable session replay.
 *
 * Essential cookies (auth session) are never gated — POPIA permits them as
 * necessary to deliver the service.
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Defer slightly so the banner doesn't fight with the page's first paint.
    const id = setTimeout(() => setOpen(getConsent() === null), 600);
    return () => clearTimeout(id);
  }, []);

  const choose = (tracking: boolean) => {
    setConsent(tracking);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cookie-banner"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 pb-safe"
          role="dialog"
          aria-live="polite"
          aria-label="Cookie preferences"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-[#F3F4F6] p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FAFAFA] border border-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                <Cookie className="w-4 h-4 text-[#6B7280]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-[#0F0F0F]">A note on data</h2>
                <p className="text-[13px] text-[#6B7280] mt-1 leading-relaxed">
                  We use essential cookies to keep you signed in. With your consent we also record diagnostic session replays when an error happens, so we can fix it faster. You can change this any time from <span className="text-[#0F0F0F] font-medium">Privacy &amp; data</span>.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => choose(false)}
                    className="btn-ghost"
                  >
                    Essential only
                  </button>
                  <button
                    type="button"
                    onClick={() => choose(true)}
                    className="btn-primary"
                  >
                    Accept all
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { modalTransition, spring } from '../../lib/motion';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissable?: boolean;
};

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (dismissable && e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, dismissable, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={dismissable ? onClose : undefined}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(15,15,15,0.45)', backdropFilter: 'blur(8px) saturate(140%)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${sizeClass[size]} bg-white rounded-3xl border border-[#F3F4F6] shadow-[0_24px_64px_rgba(0,0,0,0.20)] overflow-hidden`}
            variants={modalTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={spring.snappy}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || dismissable) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-2">
                <div className="min-w-0 pr-4">
                  {title && (
                    <h2 className="text-lg font-semibold text-[#0F0F0F] leading-tight">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-[#6B7280] leading-relaxed">{description}</p>
                  )}
                </div>
                {dismissable && (
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#0F0F0F]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 py-4">{children}</div>
            {footer && (
              <div className="px-6 py-4 border-t border-[#F3F4F6] bg-[#FAFAFA] flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

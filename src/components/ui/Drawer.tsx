import type { ReactNode } from 'react';
import { Drawer as VaulDrawer } from 'vaul';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function Drawer({ open, onOpenChange, title, description, children, footer }: DrawerProps) {
  return (
    <VaulDrawer.Root open={open} onOpenChange={onOpenChange}>
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-[90] bg-[rgba(15,15,15,0.45)] backdrop-blur-[6px]" />
        <VaulDrawer.Content
          className="fixed bottom-0 left-0 right-0 z-[91] mt-24 flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-[#F3F4F6] bg-white outline-none"
        >
          <div className="mx-auto mt-2 mb-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-[#E5E7EB]" />
          {(title || description) && (
            <div className="px-5 pb-3 pt-1">
              {title && (
                <VaulDrawer.Title className="text-base font-semibold text-[#0F0F0F]">
                  {title}
                </VaulDrawer.Title>
              )}
              {description && (
                <VaulDrawer.Description className="mt-1 text-sm text-[#6B7280]">
                  {description}
                </VaulDrawer.Description>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && (
            <div className="border-t border-[#F3F4F6] bg-[#FAFAFA] px-5 py-3 pb-safe">
              {footer}
            </div>
          )}
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}

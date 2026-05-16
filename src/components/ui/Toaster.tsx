import { Toaster as SonnerToaster, toast } from 'sonner';

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      offset={16}
      gap={8}
      visibleToasts={3}
      duration={3500}
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: 'group rounded-2xl border bg-white text-[#0F0F0F] shadow-[0_8px_24px_rgba(0,0,0,0.10)] px-4 py-3 text-sm font-medium',
          title: 'font-semibold',
          description: 'text-[#6B7280] text-[13px] font-normal',
          success: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
          error:   'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
          info:    'border-[#e9d5ff] bg-[#faf5ff] text-[#6d28d9]',
          warning: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
          closeButton: 'bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#0F0F0F]',
        },
      }}
    />
  );
}

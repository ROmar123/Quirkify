import { useEffect, useRef, useState } from 'react';

/**
 * Hook to trap focus within a modal or dialog element
 * Ensures keyboard navigation stays within the modal
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Find all focusable elements
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Shift + Tab
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let the parent component handle closing
        container.dispatchEvent(new CustomEvent('focusTrapEscape', { bubbles: true }));
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
      // Restore focus
      previouslyFocusedElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to announce changes to screen readers
 */
export function useAnnouncer() {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(`aria-announcer-${priority}`);
    if (announcer) {
      announcer.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  };

  return { announce };
}

/**
 * Hook for keyboard navigation in lists
 */
export function useListKeyboardNavigation(
  itemCount: number,
  onSelect: (index: number) => void,
  onClose?: () => void
) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(itemCount - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          onSelect(focusedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  };

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}

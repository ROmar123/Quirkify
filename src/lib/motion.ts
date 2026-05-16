import type { Transition, Variants } from 'motion/react';

// ── Spring presets ─────────────────────────────────────────────────────────
// Emil Kowalski-style tactile motion: physics-based, not eased.
// Use these everywhere you'd otherwise hand-tune ease/duration.

export const spring = {
  gentle:  { type: 'spring', stiffness: 280, damping: 32, mass: 0.9 } as Transition,
  snappy:  { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 } as Transition,
  bouncy:  { type: 'spring', stiffness: 360, damping: 22, mass: 0.8 } as Transition,
  layout:  { type: 'spring', stiffness: 320, damping: 30, mass: 1.0 } as Transition,
  press:   { type: 'spring', stiffness: 600, damping: 28, mass: 0.5 } as Transition,
};

// ── Variant presets ────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: spring.gentle },
};

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.snappy },
};

export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: spring.gentle },
};

export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: spring.gentle },
};

export const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerFast: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const pageTransition: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { ...spring.gentle, opacity: { duration: 0.18 } } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

export const modalTransition: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
  exit:    { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

// ── Interaction helpers ────────────────────────────────────────────────────

export const tapScale = {
  whileTap: { scale: 0.97 },
  transition: spring.press,
} as const;

export const pressScale = {
  whileHover: { scale: 1.02 },
  whileTap:   { scale: 0.97 },
  transition: spring.press,
} as const;

export const cardLift = {
  whileHover: { y: -3 },
  transition: spring.gentle,
} as const;

import { Variants } from "motion/react";

// Slide animation variants for view transitions
export const slideVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

// Fade in with upward movement
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Stagger container for sequential child animations
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

// Spring transition config
export const springTransition = {
  y: { type: "spring", stiffness: 300, damping: 30 },
  opacity: { duration: 0.3 },
} as const;

// Smooth ease curve for elegant animations
export const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

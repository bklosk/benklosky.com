"use client";

import { motion, AnimatePresence } from "motion/react";

interface MobileHeaderProps {
  isProjectSelected: boolean;
  onClose?: () => void;
}

export function MobileHeader({ isProjectSelected, onClose }: MobileHeaderProps) {
  return (
    <AnimatePresence>
      {isProjectSelected && (
        <motion.header
          className="lg:hidden shrink-0 p-4 pb-2 z-20 flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="text-base font-bold text-taupe tracking-[0.2em]">
              BEN KLOSKY
            </h1>
            <p className="text-xs mono text-taupe/60">[ECONOMIST / DEVELOPER]</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mono text-sm text-taupe/50 hover:text-tiger-flame transition-colors p-2"
            >
              [CLOSE]
            </button>
          )}
        </motion.header>
      )}
    </AnimatePresence>
  );
}

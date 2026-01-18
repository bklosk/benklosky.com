"use client";

import { motion } from "motion/react";
import { bio } from "@/data/about";
import { smoothEase } from "@/lib/animations";

export function LeftSidebar() {
  return (
    <motion.aside
      className="hidden lg:flex fixed left-0 bottom-0 w-14 xl:w-16 flex-col justify-end py-6 px-3 z-20"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
    >
      <div className="flex items-end">
        <p className="vertical-text text-[9px] xl:text-[10px] text-taupe/60 tracking-[0.2em] uppercase leading-relaxed max-h-[65vh] overflow-hidden">
          {bio}
        </p>
      </div>
    </motion.aside>
  );
}

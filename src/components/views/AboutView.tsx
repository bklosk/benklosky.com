"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { slideVariants, springTransition, smoothEase } from "@/lib/animations";
import { aboutContent } from "@/data/about";

interface AboutViewProps {
  onClose: () => void;
}

export function AboutView({ onClose }: AboutViewProps) {
  return (
    <motion.div
      key="about"
      className="flex-1 flex flex-col justify-center p-4 lg:p-8 xl:p-12 pb-24 lg:pb-8 overflow-hidden"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springTransition}
    >
      {/* About Header */}
      <motion.div
        className="shrink-0 mb-6 lg:mb-6 text-center"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <h2 className="text-base lg:text-lg xl:text-xl font-bold text-taupe uppercase tracking-[0.15em]">
          About Me
        </h2>
        <p className="mono text-[10px] lg:text-xs text-taupe/50 mt-1">
          [WHO I AM]
        </p>
      </motion.div>

      {/* About Content */}
      <motion.div
        className="shrink-0 relative flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.03, duration: 0.35, ease: smoothEase }}
      >
        {/* Photo */}
        <div className="relative w-48 aspect-2/3 lg:w-64 xl:w-72 shrink-0">
          <Image
            src={aboutContent.image}
            alt="Ben Klosky"
            fill
            className="object-cover project-image"
            sizes="(max-width: 768px) 192px, (max-width: 1200px) 256px, 288px"
            priority
          />
        </div>

        {/* Bio Text */}
        <div className="max-w-md lg:max-w-lg text-center lg:text-left">
          <p className="text-xs lg:text-sm text-taupe/80 leading-relaxed whitespace-pre-line">
            {aboutContent.blurb}
          </p>
        </div>
      </motion.div>

      {/* Close button */}
      <motion.div
        className="shrink-0 flex justify-center items-center mt-6 lg:mt-8"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <button
          onClick={onClose}
          className="mono text-[10px] lg:text-xs text-taupe/40 hover:text-tiger-flame transition-colors duration-200"
        >
          [ESC TO CLOSE]
        </button>
      </motion.div>
    </motion.div>
  );
}

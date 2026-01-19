"use client";

import { motion } from "motion/react";
import { slideVariants, springTransition, smoothEase } from "@/lib/animations";

interface ResumeViewProps {
  onClose: () => void;
}

export function ResumeView({ onClose }: ResumeViewProps) {
  return (
    <motion.div
      key="resume"
      className="flex-1 flex flex-col p-4 lg:p-8 xl:p-12 overflow-hidden"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springTransition}
    >
      {/* Resume Header */}
      <motion.div
        className="shrink-0 mb-4 lg:mb-6 text-center"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <h2 className="text-base lg:text-lg xl:text-xl font-bold text-taupe uppercase tracking-[0.15em]">
          Resume
        </h2>
        <p className="mono text-[10px] lg:text-xs text-taupe/50 mt-1">
          [CURRICULUM VITAE]
        </p>
      </motion.div>

      {/* PDF Embed */}
      <motion.div
        className="flex-1 relative min-h-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.03, duration: 0.35, ease: smoothEase }}
      >
        <div className="relative w-full lg:max-w-2xl xl:max-w-3xl h-full max-h-[85vh] lg:max-h-[70vh]">
          <iframe
            src="/resume.pdf"
            className="w-full h-full border-0 project-image"
            title="Ben Klosky Resume"
          />
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="shrink-0 flex justify-between items-center mt-4 lg:mt-8 px-2 lg:px-8 xl:px-16"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <a
          href="/resume.pdf"
          download
          className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 tracking-wider"
        >
          DOWNLOAD PDF
        </a>
        <button
          onClick={onClose}
          className="mono text-[10px] lg:text-xs text-taupe/40 hover:text-tiger-flame transition-colors duration-200 hidden lg:block"
        >
          [ESC TO CLOSE]
        </button>
        <a
          href="/resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 tracking-wider"
        >
          OPEN IN NEW TAB
        </a>
      </motion.div>
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { ViewType } from "@/types";
import { fadeInUp, staggerContainer } from "@/lib/animations";

interface HomeViewProps {
  onViewChange: (view: ViewType) => void;
  onArticleSelect: (index: number) => void;
}

export function HomeView({ onViewChange, onArticleSelect }: HomeViewProps) {
  return (
    <motion.div
      key="home"
      className="flex-1 w-full h-full flex flex-col items-center justify-start lg:justify-center pt-28 sm:pt-32 lg:pt-0 px-5 py-6 sm:p-6 lg:p-8 xl:p-12 min-h-0"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* Main Title */}
      <motion.div
        className="text-center mb-6 lg:mb-10"
        variants={fadeInUp}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl lg:text-2xl xl:text-3xl font-bold text-taupe tracking-[0.25em] mb-2">
          BEN KLOSKY
        </h1>
        <p className="mono text-xs lg:text-xs text-taupe/60 tracking-wider">
          [growth engineer]
        </p>
      </motion.div>

      {/* Resume & About Links */}
      <motion.div
        className="text-center mb-6 lg:mb-8"
        variants={fadeInUp}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center justify-center gap-4 lg:gap-6 flex-wrap">
          <motion.a
            href="/resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200 tracking-wider min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            [RESUME]
          </motion.a>
          <span className="text-taupe/30 py-2">•</span>
          <motion.button
            onClick={() => onViewChange("about")}
            className="mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200 tracking-wider min-h-[44px] min-w-[44px] inline-flex items-center justify-center py-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            [ABOUT]
          </motion.button>
        </div>
      </motion.div>

      {/* Contact Section */}
      <motion.div
        className="text-center"
        variants={fadeInUp}
        transition={{ duration: 0.35 }}
      >
        <p className="text-xs lg:text-xs text-taupe tracking-[0.2em] mb-4">
          CONTACT:
        </p>
        <div className="space-y-1.5">
          <motion.a
            href="mailto:benklosky@uchicago.edu"
            className="block mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200 link-hover"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            [benklosky@uchicago.edu]
          </motion.a>
          <motion.a
            href="https://github.com/bklosk"
            target="_blank"
            rel="noopener noreferrer"
            className="block mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            GITHUB
          </motion.a>
          <motion.a
            href="https://www.linkedin.com/in/ben-klosky/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            LINKEDIN
          </motion.a>
          <motion.a
            href="https://twitter.com/benklosky"
            target="_blank"
            rel="noopener noreferrer"
            className="block mono text-xs lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            X
          </motion.a>
        </div>
      </motion.div>

      {/* Call to action */}
      <motion.div
        className="mt-8 lg:mt-12"
        variants={fadeInUp}
        transition={{ duration: 0.35 }}
      >
        <motion.button
          onClick={() => onArticleSelect(0)}
          className="mono text-xs sm:text-xs lg:text-xs text-taupe/50 hover:text-tiger-flame transition-colors duration-200 tracking-wider min-h-[44px] px-3 inline-flex items-center justify-center"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          READ BLOG →
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

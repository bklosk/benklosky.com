"use client";

import { motion } from "motion/react";
import { Article } from "@/types";
import { slideVariants, springTransition } from "@/lib/animations";

interface ArticleViewProps {
  article: Article;
  onClose: () => void;
}

export function ArticleView({ article, onClose }: ArticleViewProps) {
  return (
    <motion.div
      key={`article-${article.id}`}
      className="flex-1 flex flex-col p-4 lg:p-8 xl:p-12 overflow-hidden"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springTransition}
    >
      <div className="flex-1 max-w-3xl mx-auto w-full min-h-0 overflow-y-auto py-4 lg:py-0 pr-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mono text-xs text-taupe/50 mb-4">
            <span>{article.date}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>
          
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-taupe tracking-wide leading-tight mb-6">
            {article.title}
          </h1>

          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span 
                key={tag}
                className="px-2 py-1 border border-taupe/20 rounded-sm mono text-[10px] text-taupe/60 uppercase tracking-wider"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="w-full h-px bg-tiger-flame/20 mb-8"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="prose prose-taupe max-w-none"
        >
          {article.content.split('\n').map((paragraph, index) => (
            paragraph.trim() && (
              <p key={index} className="text-base lg:text-lg text-taupe/80 leading-relaxed mb-6">
                {paragraph.trim()}
              </p>
            )
          ))}
        </motion.div>
        
        {/* Footer Navigation */}
        <motion.div 
          className="mt-12 pt-8 border-t border-taupe/10 flex justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button 
            onClick={onClose}
            className="mono text-xs text-taupe/50 hover:text-tiger-flame transition-colors"
          >
            ← BACK TO HOME
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

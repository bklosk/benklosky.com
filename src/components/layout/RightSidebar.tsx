"use client";

import { motion } from "motion/react";
import { Article } from "@/types";
import { smoothEase } from "@/lib/animations";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface RightSidebarProps {
  articles: Article[];
  selectedIndex: number | null;
  onArticleSelect: (index: number) => void;
}

export function RightSidebar({
  articles,
  selectedIndex,
  onArticleSelect,
}: RightSidebarProps) {
  return (
    <motion.aside
      className="hidden lg:flex fixed right-0 top-0 bottom-0 w-32 xl:w-48 flex-col py-8 z-20 overflow-y-auto border-l border-taupe/5 bg-parchment/50 backdrop-blur-sm"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
    >
      <div className="px-4 mb-6 flex flex-col gap-6">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <h3 className="mono text-[10px] text-taupe/40 uppercase tracking-widest">Recent Thoughts</h3>
      </div>
      
      <div className="flex flex-col gap-4 px-4">
        {articles.map((article, index) => (
          <motion.button
            key={article.id}
            onClick={() => onArticleSelect(index)}
            className={`group relative text-left transition-all duration-300 ${
              selectedIndex === index
                ? "opacity-100"
                : "opacity-60 hover:opacity-100"
            }`}
            initial={{ opacity: 0, x: 15 }}
            animate={{
              opacity: selectedIndex === index ? 1 : 0.6,
              x: 0,
            }}
            transition={{
              delay: 0.15 + index * 0.05,
              duration: 0.3,
              ease: smoothEase,
            }}
            whileHover={{ x: -2 }}
          >
            <div className="flex flex-col gap-1">
              <span className="mono text-[10px] text-taupe/40">
                {article.date}
              </span>
              <span 
                className={`text-xs font-medium leading-snug transition-colors duration-200 ${
                  selectedIndex === index 
                    ? "text-tiger-flame" 
                    : "text-taupe group-hover:text-tiger-flame"
                }`}
              >
                {article.title}
              </span>
            </div>
            
            {/* Active indicator */}
            {selectedIndex === index && (
              <motion.div 
                layoutId="activeArticle"
                className="absolute -left-4 top-1 bottom-1 w-0.5 bg-tiger-flame"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </motion.aside>
  );
}

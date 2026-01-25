"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Project } from "@/types";

interface MobileProjectBarProps {
  projects: Project[];
  selectedIndex: number | null;
  onProjectSelect: (index: number) => void;
  isProjectSelected: boolean;
}

export function MobileProjectBar({
  projects,
  selectedIndex,
  onProjectSelect,
  isProjectSelected,
}: MobileProjectBarProps) {
  return (
    <AnimatePresence>
      {!isProjectSelected && (
        <motion.aside
          className="lg:hidden fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2 bg-gradient-to-t from-parchment via-parchment to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {projects.map((project, index) => (
          <motion.button
            key={project.id}
            onClick={() => onProjectSelect(index)}
            className={`shrink-0 relative transition-all duration-300 ${
              selectedIndex === index ? "opacity-100 scale-105" : "opacity-60"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative w-14 h-10 overflow-hidden rounded-sm">
              <Image
                src={project.image}
                alt={project.title}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <span
              className={`absolute -top-1 -left-1 mono text-[10px] ${
                selectedIndex === index ? "text-tiger-flame" : "text-taupe/50"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          </motion.button>
        ))}
      </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

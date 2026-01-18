"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Project } from "@/types";
import { slideVariants, springTransition, smoothEase } from "@/lib/animations";

interface ProjectViewProps {
  project: Project;
  projectIndex: number;
  totalProjects: number;
  direction: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function ProjectView({
  project,
  projectIndex,
  totalProjects,
  direction,
  onPrevious,
  onNext,
  onClose,
}: ProjectViewProps) {
  return (
    <motion.div
      key={`project-${project.id}`}
      className="flex-1 flex flex-col p-4 lg:p-8 xl:p-12 overflow-hidden"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springTransition}
    >
      {/* Project Header */}
      <motion.div
        className="shrink-0 mb-4 lg:mb-6 text-center"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <p className="mono text-[10px] lg:text-xs text-taupe/50 mb-1">
          [{String(projectIndex + 1).padStart(2, "0")}]
        </p>
        <h2 className="text-base lg:text-lg xl:text-xl font-bold text-taupe uppercase tracking-[0.15em]">
          {project.title}
        </h2>
        <p className="mono text-[10px] lg:text-xs text-taupe/50 mt-1">
          [{project.category}]
        </p>
      </motion.div>

      {/* Project Image */}
      <motion.div
        className="flex-1 relative min-h-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.03, duration: 0.35, ease: smoothEase }}
      >
        <div className="relative w-full max-w-xl xl:max-w-2xl aspect-[4/3]">
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="object-cover project-image"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 50vw"
            priority
          />
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div
        className="shrink-0 flex justify-between items-center mt-4 lg:mt-8 px-2 lg:px-8 xl:px-16"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <button
          onClick={onPrevious}
          disabled={projectIndex === 0}
          className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 disabled:opacity-20 disabled:cursor-not-allowed tracking-wider"
        >
          PREVIOUS
        </button>
        <button
          onClick={onClose}
          className="mono text-[10px] lg:text-xs text-taupe/40 hover:text-tiger-flame transition-colors duration-200 hidden lg:block"
        >
          [ESC TO CLOSE]
        </button>
        <button
          onClick={onNext}
          disabled={projectIndex === totalProjects - 1}
          className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 disabled:opacity-20 disabled:cursor-not-allowed tracking-wider"
        >
          NEXT
        </button>
      </motion.div>
    </motion.div>
  );
}

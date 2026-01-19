"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Project } from "@/types";
import { slideVariants, springTransition, smoothEase } from "@/lib/animations";

interface ProjectViewProps {
  project: Project;
  projectIndex: number;
}

export function ProjectView({
  project,
  projectIndex,
}: ProjectViewProps) {
  return (
    <motion.div
      key={`project-${project.id}`}
      className="flex-1 flex flex-col p-4 lg:p-8 xl:p-12 overflow-hidden"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springTransition}
    >
      {/* Main Content Area: Two columns on desktop, two rows on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 xl:gap-16 max-w-6xl mx-auto w-full min-h-0 overflow-y-auto lg:overflow-visible py-4 lg:py-0">
        
        {/* Left/Top Column: Image */}
        <motion.div
          className="w-full lg:w-1/2 flex justify-center lg:justify-end shrink-0"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.02, duration: 0.25, ease: smoothEase }}
        >
          <div className="relative w-full max-w-sm lg:max-w-md xl:max-w-lg shadow-sm">
            <Image
              src={project.image}
              alt={project.title}
              width={1200}
              height={900}
              className="w-full h-auto object-contain project-image border border-taupe/5"
              priority
            />
          </div>
        </motion.div>

        {/* Right/Bottom Column: Description */}
        <motion.div
          className="w-full lg:w-1/2 flex flex-col text-left lg:pl-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.25 }}
        >
          <div className="mb-4">
            <p className="mono text-[10px] lg:text-xs text-taupe/50 mb-1">
              [{String(projectIndex + 1).padStart(2, "0")}]
            </p>
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-bold text-taupe uppercase tracking-[0.15em] leading-tight">
              {project.title}
            </h2>
            <div className="flex gap-4 mt-2 mono text-[10px] lg:text-xs text-taupe/40">
              <span>[{project.category.toUpperCase()}]</span>
              <span>[{project.year}]</span>
            </div>
          </div>
          
          <div className="w-12 h-px bg-tiger-flame/30 mb-6" />
          
          <p className="text-sm lg:text-base text-taupe/80 leading-relaxed max-w-prose">
            {project.description}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

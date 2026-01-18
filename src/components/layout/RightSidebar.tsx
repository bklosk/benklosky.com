"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Project } from "@/types";
import { smoothEase } from "@/lib/animations";

interface RightSidebarProps {
  projects: Project[];
  selectedIndex: number | null;
  onProjectSelect: (index: number) => void;
}

export function RightSidebar({
  projects,
  selectedIndex,
  onProjectSelect,
}: RightSidebarProps) {
  return (
    <motion.aside
      className="hidden lg:flex fixed right-0 top-0 bottom-0 w-28 xl:w-36 flex-col py-4 z-20 overflow-y-auto"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
    >
      <div className="flex flex-col gap-2 pl-3 pr-3">
        {projects.map((project, index) => (
          <motion.button
            key={project.id}
            onClick={() => onProjectSelect(index)}
            className={`group relative text-left transition-all duration-300 ${
              selectedIndex === index
                ? "opacity-100"
                : "opacity-50 hover:opacity-90"
            }`}
            initial={{ opacity: 0, x: 15 }}
            animate={{
              opacity: selectedIndex === index ? 1 : 0.5,
              x: 0,
            }}
            transition={{
              delay: 0.15 + index * 0.02,
              duration: 0.3,
              ease: smoothEase,
            }}
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.97 }}
          >
            {/* Number */}
            <span
              className={`absolute -left-1 top-0 mono text-[10px] transition-colors duration-200 ${
                selectedIndex === index
                  ? "text-tiger-flame"
                  : "text-taupe/40 group-hover:text-tiger-flame"
              }`}
            >
              {String(index + 1).padStart(2, "0")}]
            </span>

            {/* Thumbnail */}
            <div
              className={`relative aspect-[4/3] overflow-hidden ml-5 transition-all duration-300 ${
                selectedIndex === index
                  ? "thumbnail-active"
                  : "grayscale-[30%] group-hover:grayscale-0"
              }`}
            >
              <Image
                src={project.image}
                alt={project.title}
                fill
                className="object-cover"
                sizes="140px"
              />
              {/* Hover overlay */}
              <div
                className={`absolute inset-0 transition-opacity duration-300 ${
                  selectedIndex === index
                    ? "opacity-0"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                style={{
                  background: `linear-gradient(180deg, transparent 50%, ${project.color}30 100%)`,
                }}
              />
            </div>

            {/* Title on hover (desktop only) */}
            <motion.span className="hidden xl:block absolute -left-24 top-1/2 -translate-y-1/2 text-[8px] mono text-taupe/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {project.title.toUpperCase()}
            </motion.span>
          </motion.button>
        ))}
      </div>
    </motion.aside>
  );
}

"use client";

import { motion } from "motion/react";
import { bioLinks } from "@/data/about";
import { smoothEase } from "@/lib/animations";
import { ViewType } from "@/types";
import React from "react";

interface LeftSidebarProps {
  onViewChange?: (view: ViewType) => void;
}

export function LeftSidebar({ onViewChange }: LeftSidebarProps) {
  return (
    <motion.aside
      className="hidden lg:flex fixed left-0 bottom-0 w-14 xl:w-16 flex-col justify-end py-6 px-3 z-20"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: smoothEase }}
    >
      <div className="flex items-end">
        <div className="vertical-text text-[9px] xl:text-[10px] text-taupe/60 tracking-[0.2em] uppercase leading-relaxed max-h-[65vh] overflow-hidden whitespace-nowrap">
          {bioLinks.map((link, index) => (
            <React.Fragment key={link.label}>
              {link.href ? (
                <a
                  href={link.href}
                  target={link.isExternal ? "_blank" : undefined}
                  rel={link.isExternal ? "noopener noreferrer" : undefined}
                  className="hover:text-tiger-flame transition-colors duration-200 cursor-pointer inline-block"
                >
                  {link.label}
                </a>
              ) : link.view ? (
                <button
                  onClick={() => onViewChange?.(link.view!)}
                  className="hover:text-tiger-flame transition-colors duration-200 cursor-pointer uppercase inline-block"
                >
                  {link.label}
                </button>
              ) : (
                <span className="inline-block">{link.label}</span>
              )}
              {index < bioLinks.length - 1 && <span className="mx-1 opacity-40">.</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

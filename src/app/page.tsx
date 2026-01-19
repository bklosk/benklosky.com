"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

// Types
import { ViewType } from "@/types";

// Data
import { projects } from "@/data/projects";

// Animation utilities
import { smoothEase } from "@/lib/animations";

// Layout components
import {
  MobileHeader,
  LeftSidebar,
  RightSidebar,
  MobileProjectBar,
  MobileFooter,
} from "@/components/layout";

// View components
import {
  HomeView,
  ProjectView,
  AboutView,
  ResumeView,
} from "@/components/views";

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedProject = useMemo(
    () => (selectedIndex !== null ? projects[selectedIndex] : null),
    [selectedIndex]
  );

  const handleProjectSelect = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      setCurrentView("project");
    },
    []
  );

  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
    if (view !== "project") {
      setSelectedIndex(null);
    }
  }, []);

  const handlePrevious = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < projects.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
    setCurrentView("home");
  }, []);

  // Handle Escape key to close views
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && currentView !== "home") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView, handleClose]);

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row bg-parchment overflow-hidden texture-overlay">
      {/* Mobile Header - Only visible when project is selected */}
      <MobileHeader 
        isProjectSelected={currentView === "project" && selectedProject !== null}
        onClose={handleClose}
      />

      {/* Left Sidebar - Vertical Bio */}
      <LeftSidebar />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-14 xl:ml-16 lg:mr-28 xl:mr-36 flex flex-col overflow-hidden relative z-10 pb-20 lg:pb-0 h-full lg:h-screen">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <AnimatePresence mode="wait">
            {currentView === "project" && selectedProject ? (
              <ProjectView
                project={selectedProject}
                projectIndex={selectedIndex!}
              />
            ) : currentView === "about" ? (
              <AboutView onClose={handleClose} />
            ) : currentView === "resume" ? (
              <ResumeView onClose={handleClose} />
            ) : (
              <HomeView
                onViewChange={handleViewChange}
                onProjectSelect={handleProjectSelect}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Persistent Project Navigation */}
        <AnimatePresence>
          {currentView === "project" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="shrink-0 flex justify-between items-center pb-8 lg:pb-12 xl:pb-16 px-6 lg:px-16 xl:px-24 relative z-20"
            >
              <button
                onClick={handlePrevious}
                disabled={selectedIndex === 0}
                className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 disabled:opacity-20 disabled:cursor-not-allowed tracking-wider"
              >
                PREVIOUS
              </button>
              <button
                onClick={handleClose}
                className="mono text-[10px] lg:text-xs text-taupe/40 hover:text-tiger-flame transition-colors duration-200 hidden lg:block"
              >
                [ESC TO CLOSE]
              </button>
              <button
                onClick={handleNext}
                disabled={selectedIndex === projects.length - 1}
                className="mono text-xs lg:text-sm text-taupe hover:text-tiger-flame transition-colors duration-200 disabled:opacity-20 disabled:cursor-not-allowed tracking-wider"
              >
                NEXT
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horizontal divider line at bottom */}
        <motion.div
          className="hidden lg:block absolute bottom-6 left-8 right-8 divider-line"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: smoothEase }}
        />
      </main>

      {/* Right Sidebar - Project Thumbnails (Desktop only) */}
      <RightSidebar
        projects={projects}
        selectedIndex={selectedIndex}
        onProjectSelect={handleProjectSelect}
      />

      {/* Mobile Project Thumbnails - Horizontal strip at bottom */}
      <MobileProjectBar
        projects={projects}
        selectedIndex={selectedIndex}
        onProjectSelect={handleProjectSelect}
        isProjectSelected={currentView === "project"}
      />

      {/* Mobile Footer */}
      <MobileFooter />
    </div>
  );
}

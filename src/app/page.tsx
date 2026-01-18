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
  const [direction, setDirection] = useState(0);

  const selectedProject = useMemo(
    () => (selectedIndex !== null ? projects[selectedIndex] : null),
    [selectedIndex]
  );

  const handleProjectSelect = useCallback(
    (index: number) => {
      if (selectedIndex !== null) {
        setDirection(index > selectedIndex ? 1 : -1);
      } else {
        setDirection(1);
      }
      setSelectedIndex(index);
      setCurrentView("project");
    },
    [selectedIndex]
  );

  const handleViewChange = useCallback((view: ViewType) => {
    setDirection(1);
    setCurrentView(view);
    if (view !== "project") {
      setSelectedIndex(null);
    }
  }, []);

  const handlePrevious = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setDirection(-1);
      setSelectedIndex(selectedIndex - 1);
    }
  }, [selectedIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < projects.length - 1) {
      setDirection(1);
      setSelectedIndex(selectedIndex + 1);
    }
  }, [selectedIndex]);

  const handleClose = useCallback(() => {
    setDirection(0);
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
      <main className="flex-1 min-h-0 lg:ml-14 xl:ml-16 lg:mr-28 xl:mr-36 flex flex-col overflow-hidden relative z-10 pt-8 pb-28 lg:pt-0 lg:pb-0 lg:h-screen">
        <AnimatePresence mode="wait" custom={direction}>
          {currentView === "project" && selectedProject ? (
            <ProjectView
              project={selectedProject}
              projectIndex={selectedIndex!}
              totalProjects={projects.length}
              direction={direction}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onClose={handleClose}
            />
          ) : currentView === "about" ? (
            <AboutView direction={direction} onClose={handleClose} />
          ) : currentView === "resume" ? (
            <ResumeView direction={direction} onClose={handleClose} />
          ) : (
            <HomeView
              onViewChange={handleViewChange}
              onProjectSelect={handleProjectSelect}
            />
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

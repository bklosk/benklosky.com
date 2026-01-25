"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

// Types
import { ViewType } from "@/types";

// Data
import { articles } from "@/data/articles";

// Animation utilities
import { smoothEase } from "@/lib/animations";

// Layout components
import {
  MobileHeader,
  LeftSidebar,
  RightSidebar,
  MobileFooter,
} from "@/components/layout";

// View components
import {
  HomeView,
  ArticleView,
  AboutView,
} from "@/components/views";

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedArticle = useMemo(
    () => (selectedIndex !== null ? articles[selectedIndex] : null),
    [selectedIndex]
  );

  const handleArticleSelect = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      setCurrentView("article");
    },
    []
  );

  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
    if (view !== "article") {
      setSelectedIndex(null);
    }
  }, []);

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
      {/* Mobile Header - Only visible when article is selected */}
      <MobileHeader 
        isProjectSelected={currentView === "article" && selectedArticle !== null}
        onClose={handleClose}
      />

      {/* Left Sidebar - Vertical Bio */}
      <LeftSidebar onViewChange={handleViewChange} />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-14 xl:ml-16 lg:mr-32 xl:mr-48 flex flex-col overflow-hidden relative z-10 pb-20 lg:pb-0 h-full lg:h-screen">
        <div className="flex-1 flex flex-col min-h-0 relative">
          <AnimatePresence mode="wait">
            {currentView === "article" && selectedArticle ? (
              <ArticleView
                article={selectedArticle}
                onClose={handleClose}
              />
            ) : currentView === "about" ? (
              <AboutView onClose={handleClose} />
            ) : (
              <HomeView
                onViewChange={handleViewChange}
                onArticleSelect={handleArticleSelect}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Horizontal divider line at bottom */}
        <motion.div
          className="hidden lg:block absolute bottom-6 left-8 right-8 divider-line"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: smoothEase }}
        />
      </main>

      {/* Right Sidebar - Recent Articles (Desktop only) */}
      <RightSidebar
        articles={articles}
        selectedIndex={selectedIndex}
        onArticleSelect={handleArticleSelect}
      />

      {/* Mobile Footer */}
      <MobileFooter />
    </div>
  );
}

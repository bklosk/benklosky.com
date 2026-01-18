"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

// Project data - replace with your actual projects
const projects = [
  {
    id: 1,
    title: "Project Alpha",
    subtitle: "Web Application",
    category: "DEVELOPMENT",
    year: "2025",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    color: "#ff6933",
  },
  {
    id: 2,
    title: "Design System",
    subtitle: "Component Library",
    category: "UI/UX",
    year: "2025",
    image: "https://images.unsplash.com/photo-1545235617-9465d2a55698?w=800&q=80",
    color: "#8b95c9",
  },
  {
    id: 3,
    title: "Mobile App",
    subtitle: "iOS & Android",
    category: "DEVELOPMENT",
    year: "2024",
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
    color: "#7f9172",
  },
  {
    id: 4,
    title: "E-Commerce",
    subtitle: "Full Stack Platform",
    category: "DEVELOPMENT",
    year: "2024",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    color: "#ff6933",
  },
  {
    id: 5,
    title: "Data Visualization",
    subtitle: "Analytics Dashboard",
    category: "DATA",
    year: "2024",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    color: "#8b95c9",
  },
  {
    id: 6,
    title: "Brand Identity",
    subtitle: "Visual Design",
    category: "DESIGN",
    year: "2023",
    image: "https://images.unsplash.com/photo-1634942537034-2531766767d1?w=800&q=80",
    color: "#7f9172",
  },
  {
    id: 7,
    title: "API Platform",
    subtitle: "Backend Services",
    category: "DEVELOPMENT",
    year: "2023",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
    color: "#ff6933",
  },
  {
    id: 8,
    title: "Portfolio V2",
    subtitle: "Personal Website",
    category: "DESIGN",
    year: "2023",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80",
    color: "#8b95c9",
  },
  {
    id: 9,
    title: "Creative Studio",
    subtitle: "Agency Website",
    category: "DEVELOPMENT",
    year: "2022",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    color: "#7f9172",
  },
];

const bio = "CRAFTING DIGITAL EXPERIENCES WITH CODE AND CREATIVITY. FOCUSED ON BUILDING ELEGANT, PERFORMANT SOLUTIONS THAT PUSH BOUNDARIES.";

// Animation variants
const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export default function Home() {
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
    },
    [selectedIndex]
  );

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
  }, []);

  // Handle Escape key to close project view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedIndex !== null) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, handleClose]);

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row bg-parchment overflow-hidden texture-overlay">
      {/* Mobile Header */}
      <motion.header
        className="lg:hidden flex-shrink-0 p-4 pb-2 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h1 className="text-base font-bold text-taupe tracking-[0.2em]">BEN KLOSKY</h1>
        <p className="text-[10px] mono text-taupe/60">[SOFTWARE ENGINEER]</p>
      </motion.header>

      {/* Left Sidebar - Vertical Bio */}
      <motion.aside
        className="hidden lg:flex fixed left-0 bottom-0 w-14 xl:w-16 flex-col justify-end py-6 px-3 z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Vertical Bio Text */}
        <div className="flex items-end">
          <p className="vertical-text text-[9px] xl:text-[10px] text-taupe/60 tracking-[0.2em] uppercase leading-relaxed max-h-[65vh] overflow-hidden">
            {bio}
          </p>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-14 xl:ml-16 lg:mr-28 xl:mr-36 flex flex-col overflow-hidden relative z-10 pb-28 lg:pb-0 lg:h-screen">
        <AnimatePresence mode="wait" custom={direction}>
          {selectedProject ? (
            /* Selected Project View */
            <motion.div
              key={`project-${selectedProject.id}`}
              className="flex-1 flex flex-col p-4 lg:p-8 xl:p-12 overflow-hidden"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                y: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.3 },
              }}
            >
              {/* Project Header */}
              <motion.div
                className="flex-shrink-0 mb-4 lg:mb-6 text-center"
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <p className="mono text-[10px] lg:text-xs text-taupe/50 mb-1">
                  [{String(selectedIndex! + 1).padStart(2, "0")}]
                </p>
                <h2 className="text-base lg:text-lg xl:text-xl font-bold text-taupe uppercase tracking-[0.15em]">
                  {selectedProject.title}
                </h2>
                <p className="mono text-[10px] lg:text-xs text-taupe/50 mt-1">
                  [{selectedProject.category}]
                </p>
              </motion.div>

              {/* Project Image */}
              <motion.div
                className="flex-1 relative min-h-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="relative w-full max-w-xl xl:max-w-2xl aspect-[4/3]">
                  <Image
                    src={selectedProject.image}
                    alt={selectedProject.title}
                    fill
                    className="object-cover project-image"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 50vw"
                    priority
                  />
                </div>
              </motion.div>

              {/* Navigation */}
              <motion.div
                className="flex-shrink-0 flex justify-between items-center mt-4 lg:mt-8 px-2 lg:px-8 xl:px-16"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
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
            </motion.div>
          ) : (
            /* Home View */
            <motion.div
              key="home"
              className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8 xl:p-12"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              {/* Main Title */}
              <motion.div className="text-center mb-6 lg:mb-10" variants={fadeInUp} transition={{ duration: 0.5 }}>
                <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-taupe tracking-[0.25em] mb-2">
                  BEN KLOSKY
                </h1>
                <p className="mono text-[10px] lg:text-xs text-taupe/60 tracking-wider">
                  [SOFTWARE ENGINEER]
                </p>
              </motion.div>

              {/* Location */}
              <motion.div className="text-center mb-6 lg:mb-10" variants={fadeInUp} transition={{ duration: 0.5, delay: 0.1 }}>
                <p className="text-xs lg:text-sm text-taupe tracking-[0.2em] mb-1">
                  SAN FRANCISCO, CA & REMOTE
                </p>
                <p className="mono text-[10px] lg:text-xs text-taupe/50">
                  [AVAILABLE FOR PROJECTS]
                </p>
              </motion.div>

              {/* Contact Section */}
              <motion.div className="text-center" variants={fadeInUp} transition={{ duration: 0.5, delay: 0.2 }}>
                <p className="text-[10px] lg:text-xs text-taupe tracking-[0.2em] mb-4">
                  CONTACT & FOLLOW ME:
                </p>
                <div className="space-y-1.5">
                  <motion.a
                    href="mailto:hello@benklosky.com"
                    className="block mono text-[10px] lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200 link-hover"
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    [HELLO@BENKLOSKY.COM]
                  </motion.a>
                  <motion.a
                    href="https://github.com/benklosky"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mono text-[10px] lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    GITHUB
                  </motion.a>
                  <motion.a
                    href="https://linkedin.com/in/benklosky"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mono text-[10px] lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    LINKEDIN
                  </motion.a>
                  <motion.a
                    href="https://twitter.com/benklosky"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mono text-[10px] lg:text-xs text-taupe/60 hover:text-tiger-flame transition-colors duration-200"
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    X
                  </motion.a>
                </div>
              </motion.div>

              {/* Call to action */}
              <motion.div
                className="mt-8 lg:mt-12"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: 0.35 }}
              >
                <motion.button
                  onClick={() => handleProjectSelect(0)}
                  className="mono text-[10px] lg:text-xs text-taupe/50 hover:text-tiger-flame transition-colors duration-200 tracking-wider"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  SELECT A PROJECT →
                </motion.button>
              </motion.div>

              {/* Mobile bio */}
              <motion.div
                className="lg:hidden mt-8 max-w-[280px] text-center"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <p className="text-[9px] text-taupe/40 tracking-wider leading-relaxed uppercase">
                  {bio}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horizontal divider line at bottom */}
        <motion.div
          className="hidden lg:block absolute bottom-6 left-8 right-8 divider-line"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </main>

      {/* Right Sidebar - Project Thumbnails (Desktop only) */}
      <motion.aside
        className="hidden lg:flex fixed right-0 top-0 bottom-0 w-28 xl:w-36 flex-col py-4 z-20 overflow-y-auto"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col gap-2 pr-3">
          {projects.map((project, index) => (
            <motion.button
              key={project.id}
              onClick={() => handleProjectSelect(index)}
              className={`group relative text-left transition-all duration-300 ${
                selectedIndex === index ? "opacity-100" : "opacity-50 hover:opacity-90"
              }`}
              initial={{ opacity: 0, x: 25 }}
              animate={{
                opacity: selectedIndex === index ? 1 : 0.5,
                x: 0,
              }}
              transition={{
                delay: 0.5 + index * 0.04,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Number */}
              <span
                className={`absolute -left-1 top-0 mono text-[10px] transition-colors duration-200 ${
                  selectedIndex === index ? "text-tiger-flame" : "text-taupe/40 group-hover:text-tiger-flame"
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
                    selectedIndex === index ? "opacity-0" : "opacity-0 group-hover:opacity-100"
                  }`}
                  style={{ background: `linear-gradient(180deg, transparent 50%, ${project.color}30 100%)` }}
                />
              </div>

              {/* Title on hover (desktop only) */}
              <motion.span
                className="hidden xl:block absolute -left-24 top-1/2 -translate-y-1/2 text-[8px] mono text-taupe/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
              >
                {project.title.toUpperCase()}
              </motion.span>
            </motion.button>
          ))}
        </div>
      </motion.aside>

      {/* Mobile Project Thumbnails - Horizontal strip at bottom */}
      <motion.aside
        className="lg:hidden fixed bottom-16 left-0 right-0 z-20 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {projects.map((project, index) => (
            <motion.button
              key={project.id}
              onClick={() => handleProjectSelect(index)}
              className={`flex-shrink-0 relative transition-all duration-300 ${
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
                className={`absolute -top-1 -left-1 mono text-[8px] ${
                  selectedIndex === index ? "text-tiger-flame" : "text-taupe/50"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.aside>

      {/* Mobile Footer */}
      <motion.footer
        className="lg:hidden flex-shrink-0 p-3 text-center z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-[10px] mono text-taupe/40">©2026</p>
      </motion.footer>
    </div>
  );
}

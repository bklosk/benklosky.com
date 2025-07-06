"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Dynamic import for Macy
const loadMacy = () => import("macy");

interface GalleryItem {
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}

interface GalleryProps {
  items: GalleryItem[];
  galleryID: string;
}

export default function Gallery({ items, galleryID }: GalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const openLightbox = useCallback((item: GalleryItem, index: number) => {
    setSelectedItem(item);
    setSelectedIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setSelectedItem(null);
    setSelectedIndex(-1);
  }, []);

  const navigateNext = useCallback(() => {
    if (selectedIndex < items.length - 1) {
      const nextIndex = selectedIndex + 1;
      setSelectedIndex(nextIndex);
      setSelectedItem(items[nextIndex]);
    } else {
      // Loop to first item
      setSelectedIndex(0);
      setSelectedItem(items[0]);
    }
  }, [selectedIndex, items]);

  const navigatePrev = useCallback(() => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      setSelectedItem(items[prevIndex]);
    } else {
      // Loop to last item
      const lastIndex = items.length - 1;
      setSelectedIndex(lastIndex);
      setSelectedItem(items[lastIndex]);
    }
  }, [selectedIndex, items]);

  useEffect(() => {
    let macy: { destroy: () => void } | null = null;

    const initializeGallery = async () => {
      try {
        // Initialize Macy for masonry layout
        const MacyModule = await loadMacy();
        const MacyClass = MacyModule.default;

        if (galleryRef.current) {
          macy = new MacyClass({
            container: `#${galleryID}`,
            trueOrder: false,
            waitForImages: true,
            margin: 6,
            columns: 4,
            breakAt: {
              1200: 3,
              768: 2,
              480: 1,
            },
          });
        }
      } catch (error) {
        console.error("Error initializing gallery:", error);
      }
    };

    initializeGallery();

    return () => {
      if (macy && typeof macy.destroy === "function") {
        macy.destroy();
      }
    };
  }, [galleryID]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItem) return;

      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowRight":
          navigateNext();
          break;
        case "ArrowLeft":
          navigatePrev();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, closeLightbox, navigateNext, navigatePrev]);

  return (
    <>
      <div
        ref={galleryRef}
        id={galleryID}
        className="max-w-5xl mx-auto px-6 md:px-8 lg:px-12"
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="mb-1.5 break-inside-avoid cursor-pointer group"
            onClick={() => openLightbox(item, index)}
          >
            <div className="block relative overflow-hidden">
              <div className="relative overflow-hidden">
                <Image
                  src={item.thumbnail}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="w-full h-auto hover:scale-105 transition-transform duration-200 ease-out"
                />
                {item.caption && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute inset-0 flex items-end"
                  >
                    <div className="w-full bg-black/75 text-white p-2 md:p-3 text-xs md:text-sm backdrop-blur-sm">
                      {item.caption}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Custom Lightbox */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Backdrop with blur effect */}
            <motion.div
              initial={{ backdropFilter: "blur(0px)" }}
              animate={{ backdropFilter: "blur(20px)" }}
              exit={{ backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 bg-black/20"
            />

            {/* Lightbox content */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut", delay: 0.1 }}
              className="relative max-w-7xl w-full h-full flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 p-4 md:p-8"
            >
              {/* Main image */}
              <motion.div
                layoutId={`gallery-item-${selectedIndex}`}
                className="flex-shrink-0 relative max-w-[90vw] md:max-w-[50vw] max-h-[50vh] md:max-h-[70vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src={selectedItem.src}
                  alt={selectedItem.alt}
                  width={selectedItem.width}
                  height={selectedItem.height}
                  className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl"
                />
              </motion.div>

              {/* Caption area - always visible if caption exists */}
              {selectedItem.caption && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.15, delay: 0.05 }}
                  className="flex-shrink-0 w-full md:w-80 max-w-[90vw] md:max-w-[30vw] self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 md:p-6 shadow-xl">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                      {selectedItem.alt}
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {selectedItem.caption}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Navigation buttons */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePrev();
                }}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors z-10"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateNext();
                }}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 md:p-3 transition-colors z-10"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeLightbox();
                }}
                className="absolute top-2 md:top-6 right-2 md:right-6 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors z-10"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

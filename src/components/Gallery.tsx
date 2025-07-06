"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import "glightbox/dist/css/glightbox.min.css";

// Dynamic imports for GLightbox and Macy
const loadGLightbox = () => import("glightbox");
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

  useEffect(() => {
    let macy: { destroy: () => void } | null = null;
    let glightbox: { destroy: () => void } | null = null;

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
            margin: 8,
            columns: 4,
            breakAt: {
              1024: 3,
              768: 2,
              640: 1,
            },
          });
        }

        // Initialize GLightbox
        const GLightboxModule = await loadGLightbox();
        const GLightboxClass = GLightboxModule.default;

        glightbox = new GLightboxClass({
          selector: `#${galleryID} [data-glightbox]`,
          loop: true,
          openEffect: "fade",
          closeEffect: "fade",
          slideEffect: "slide",
          moreText: "See more",
          moreLength: 60,
          closeButton: true,
          touchNavigation: true,
          keyboardNavigation: true,
          closeOnOutsideClick: true,
        });
      } catch (error) {
        console.error("Error initializing gallery:", error);
      }
    };

    initializeGallery();

    return () => {
      if (macy && typeof macy.destroy === "function") {
        macy.destroy();
      }
      if (glightbox && typeof glightbox.destroy === "function") {
        glightbox.destroy();
      }
    };
  }, [galleryID]);

  return (
    <div ref={galleryRef} id={galleryID} className="max-w-6xl mx-auto px-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="mb-2 break-inside-avoid cursor-pointer group"
        >
          <a
            href={item.src}
            data-glightbox={`title: ${item.caption || item.alt}; description: ${
              item.caption || ""
            }`}
            data-gallery={galleryID}
            className="block relative overflow-hidden rounded-lg"
          >
            <div className="relative overflow-hidden">
              <Image
                src={item.thumbnail}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="w-full h-auto hover:scale-105 transition-transform duration-300"
              />
              {item.caption && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileHover={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-0 left-0 right-0 bg-black/75 text-white p-3 text-sm backdrop-blur-sm"
                >
                  {item.caption}
                </motion.div>
              )}
            </div>
          </a>
        </div>
      ))}
    </div>
  );
}

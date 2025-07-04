"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

interface GalleryItem {
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  alt: string;
}

interface GalleryProps {
  items: GalleryItem[];
  galleryID: string;
}

export default function Gallery({ items, galleryID }: GalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lightbox: PhotoSwipeLightbox | null = null;

    if (galleryRef.current) {
      lightbox = new PhotoSwipeLightbox({
        gallery: `#${galleryID}`,
        children: "a",
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.9,
        showHideAnimationType: "zoom",
        initialZoomLevel: "fit",
        secondaryZoomLevel: 1.5,
        maxZoomLevel: 3,
        wheelToZoom: true,
        pinchToClose: true,
        closeOnVerticalDrag: true,
        padding: { top: 20, bottom: 40, left: 100, right: 100 },
        spacing: 0.12,
        allowPanToNext: true,
        loop: true,
        tapAction: "close",
        doubleTapAction: "zoom",
        preloaderDelay: 2000,
        errorMsg: "Image cannot be loaded",
        closeTitle: "Close (Esc)",
        zoomTitle: "Zoom",
        arrowPrevTitle: "Previous (arrow left)",
        arrowNextTitle: "Next (arrow right)",
      });

      lightbox.init();
    }

    return () => {
      if (lightbox) {
        lightbox.destroy();
      }
    };
  }, [galleryID]);
  return (
    <div
      ref={galleryRef}
      id={galleryID}
      className="columns-2 md:columns-3 lg:columns-4 gap-2 max-w-4xl mx-auto px-4 pr-20"
    >
      {items.map((item, index) => {
        // Calculate aspect ratio for dynamic sizing
        const aspectRatio = item.width / item.height;
        const isWide = aspectRatio > 1.5;
        const isTall = aspectRatio < 0.7;

        // Simple height classes based on aspect ratio
        let heightClass = "h-40";
        if (isWide) {
          heightClass = "h-32";
        } else if (isTall) {
          heightClass = "h-48";
        }

        return (
          <a
            key={index}
            href={item.src}
            data-pswp-width={item.width}
            data-pswp-height={item.height}
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer mb-2 break-inside-avoid"
          >
            <div
              className={`relative ${heightClass} bg-gray-100 overflow-hidden`}
            >
              <Image
                src={item.thumbnail}
                alt={item.alt}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          </a>
        );
      })}
    </div>
  );
}

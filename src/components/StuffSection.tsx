"use client";

import { motion } from "framer-motion";
import Gallery from "./Gallery";

// Placeholder images using picsum.photos for demonstration
const galleryItems = [
  {
    src: "https://picsum.photos/1200/800?random=1",
    thumbnail: "https://picsum.photos/400/267?random=1",
    width: 1200,
    height: 800,
    alt: "Project 1 - Web Development",
    caption:
      "A modern web application built with React and TypeScript. Features responsive design and interactive user interface.",
  },
  {
    src: "https://picsum.photos/800/1200?random=2",
    thumbnail: "https://picsum.photos/400/600?random=2",
    width: 800,
    height: 1200,
    alt: "Project 2 - Design Work",
    caption:
      "Creative design work showcasing modern aesthetics and user-centered design principles.",
  },
  {
    src: "https://picsum.photos/1000/1000?random=3",
    thumbnail: "https://picsum.photos/400/400?random=3",
    width: 1000,
    height: 1000,
    alt: "Project 3 - Mobile App",
    caption:
      "Native mobile application with intuitive navigation and seamless user experience across platforms.",
  },
  {
    src: "https://picsum.photos/1600/800?random=4",
    thumbnail: "https://picsum.photos/400/200?random=4",
    width: 1600,
    height: 800,
    alt: "Project 4 - Branding",
    caption:
      "Complete brand identity package including logo design, color palette, and typography system.",
  },
  {
    src: "https://picsum.photos/900/1200?random=5",
    thumbnail: "https://picsum.photos/400/533?random=5",
    width: 900,
    height: 1200,
    alt: "Project 5 - Photography",
    caption:
      "Professional photography work capturing moments with artistic composition and lighting.",
  },
  {
    src: "https://picsum.photos/1200/900?random=6",
    thumbnail: "https://picsum.photos/400/300?random=6",
    width: 1200,
    height: 900,
    alt: "Project 6 - Art Direction",
    caption:
      "Art direction and visual storytelling for multimedia campaigns and digital content.",
  },
];

export default function StuffSection() {
  return (
    <section
      id="stuff"
      className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
    >
      <div className="flex flex-col items-center justify-center h-full py-8">
        <div className="absolute top-8 right-16 md:top-28 md:right-8 text-right">
          <motion.h2
            className="text-foreground text-4xl font-black font-gotham mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            I make things
          </motion.h2>
          <motion.p
            className="text-foreground text-lg max-w-md leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
          >
            This is a small collection of recent projects. I mostly do software,
            but I love rapid prototyping of all kinds.
          </motion.p>
        </div>

        <motion.div
          className="w-full max-h-[60vh] overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          viewport={{ once: true }}
        >
          <Gallery items={galleryItems} galleryID="my-gallery" />
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import Gallery from "./Gallery";

// Gallery items using local images
const galleryItems = [
  {
    src: "/gallery/risc.png",
    thumbnail: "/gallery/risc.png",
    width: 1200,
    height: 800,
    alt: "RISC Project",
    caption: "RISC processor implementation and design work.",
  },
  {
    src: "/gallery/tll.png",
    thumbnail: "/gallery/tll.png",
    width: 800,
    height: 1200,
    alt: "TLL Project",
    caption: "TLL project showcasing technical implementation.",
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

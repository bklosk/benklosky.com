"use client";

import { motion } from "framer-motion";

export default function HireMeSection() {
  return (
    <section
      id="work"
      className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-4xl px-6">
          <motion.h2
            className="text-foreground text-4xl font-black font-gotham mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            work with me!
          </motion.h2>

          <motion.p
            className="text-foreground text-lg mb-8 max-w-lg leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
          >
            I build things quickly. I like untangling gnarly problems. I’ve
            shipped full-stack ML apps, closed seven-figure deals, and designed
            all kinds of products. If you need a problem solver, let’s talk.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            viewport={{ once: true }}
          >
            <a
              href="mailto:ben.klosky@gmail.com"
              className="bg-foreground text-background px-8 py-3 rounded-lg font-bold border-2 border-foreground hover:bg-background hover:text-foreground transition-colors duration-200"
            >
              Email me
            </a>
            <a
              href="https://cal.com/benklosky/15min"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-foreground text-foreground px-8 py-3 rounded-lg font-bold hover:bg-foreground hover:text-background transition-colors duration-200"
            >
              Schedule a call
            </a>
          </motion.div>

          <motion.div
            className="mt-8 flex justify-center space-x-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.6 }}
            viewport={{ once: true }}
          >
            <a
              href="https://github.com/yourusername"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:opacity-70 transition-opacity duration-200"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/yourusername"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:opacity-70 transition-opacity duration-200"
            >
              LinkedIn
            </a>
            <a
              href="https://twitter.com/yourusername"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:opacity-70 transition-opacity duration-200"
            >
              Twitter
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

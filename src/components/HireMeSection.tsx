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
            Let&apos;s work together
          </motion.h2>

          <motion.p
            className="text-foreground text-lg mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            viewport={{ once: true }}
          >
            I&apos;m always excited to take on new challenges and collaborate on
            innovative projects. Whether you need help with web development,
            design, or have an interesting idea to explore, I&apos;d love to
            hear from you.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            viewport={{ once: true }}
          >
            <a
              href="mailto:your-email@example.com"
              className="bg-foreground text-background px-8 py-3 rounded-lg font-bold hover:opacity-80 transition-opacity duration-200"
            >
              Get in touch
            </a>
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-foreground text-foreground px-8 py-3 rounded-lg font-bold hover:bg-foreground hover:text-background transition-colors duration-200"
            >
              View resume
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

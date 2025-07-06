"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function HomeSection() {
  return (
    <section
      id="home"
      className="h-screen bg-background transition-colors duration-300 snap-start snap-always relative"
    >
      <div className="absolute top-24 left-14 md:left-10 md:top-32 z-10">
        <motion.p
          className="text-foreground text-5xl font-black font-gotham text-left leading-tight tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          Hey!
        </motion.p>
        <motion.p
          className="text-foreground text-5xl font-black font-gotham text-left leading-tight tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.8 }}
        >
          I&apos;m Ben Klosky.
        </motion.p>
      </div>

      <div className="absolute top-96 left-1/2 transform -translate-x-1/2 md:top-2/3 top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-10">
        <div className="relative">
          <Image
            src="/ben.png"
            alt="Ben Klosky"
            width={640}
            height={640}
            className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full relative z-10 "
          />
          <Image
            src="/bike.png"
            alt="Ben Klosky"
            width={640}
            height={640}
            className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full absolute top-1/3 left-3/4 transform -translate-x-1/2 -translate-y-1/2 rotate-[-50deg] z-0 grayscale"
          />
          <Image
            src="/piano.png"
            alt="Ben Klosky"
            width={640}
            height={640}
            className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full absolute top-1/4 left-1/6 transform -translate-x-1/2 -translate-y-1/2 rotate-[70deg] z-0 grayscale"
            style={{ left: "calc(10%)" }}
          />
          <Image
            src="/sisyphus.png"
            alt="Ben Klosky"
            width={640}
            height={640}
            className="w-72 h-72 md:w-96 md:h-96 object-contain rounded-full absolute bottom-0 right-0 transform translate-x-1/2 z-5 grayscale"
            style={{
              transform: "translateX(50%) translateY(calc(25% - 45px))",
            }}
          />
        </div>
      </div>
    </section>
  );
}

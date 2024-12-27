"use client";
import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import localFont from "next/font/local";

const soloviev = localFont({ src: "./Soloviev.otf" });

const random = (min, max) => Math.floor(min + Math.random() * (max - min));

function createBlob() {
  let offset = 10;
  let r = [];
  for (let i = 0; i < 4; i++) {
    let n = random(offset, 100 - offset);
    r.push(n);
    r.push(100 - n);
  }
  return `${r[0]}% ${r[1]}% ${r[2]}% ${r[3]}% / ${r[4]}% ${r[6]}% ${r[7]}% ${r[5]}%`;
}

export default function Page() {
  const [isClient, setIsClient] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      controls.start({
        borderRadius: createBlob(),
        rotate: "+=40deg",
        transition: { duration: 3 },
      });
    }, 900); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [controls]);

  return (
    <main className={`bg-[#C41A17] min-h-screen h-[1500px] relative`}>
      <div
        id="mainbox"
        className="h-screen w-full absolute overflow-visible pointer-events-none"
      >
        <div className="absolute top-0 left-0 w-32 h-16 bg-green-700 rounded-tl-full transform rotate-180" />
        <div className="absolute bottom-0 right-0 w-32 h-16 bg-green-700 rounded-br-full transform rotate-180" />
        {isClient && (
          <motion.div
            id="blob"
            className="absolute inset-0 m-auto w-[400px] h-[400px] bg-[#820460]" // Made smaller
            animate={controls}
            initial={{ borderRadius: createBlob(), rotate: "0deg" }}
          />
        )}
        <h1 className="text-[#E5DACB] z-50 text-9xl text-center absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`${soloviev.className} inline-block`}
            initial={{ x: -2000, y: -50, rotate: 2 }}
            animate={{ x: 30 }}
            transition={{
              delay: 0.8,
              duration: 2,
              easing: "easeInOut",
            }}
            style={{ display: "inline-block" }}
          >
            {Array.from("Ben").map((char, index) => (
              <motion.span
                key={index}
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  repeat: Infinity,
                  repeatType: "mirror",
                  duration: 2,
                  delay: index * 0.1,
                }}
                style={{ display: "inline-block" }}
              >
                {char}
              </motion.span>
            ))}
          </motion.span>
          <motion.span
            className={`${soloviev.className} inline-block`}
            initial={{ x: 2000, y: 50, rotate: -10 }}
            animate={{ x: 50, y: 50 }}
            transition={{
              delay: 1,
              duration: 1,
              easing: "easeInOut",
            }}
            style={{ display: "inline-block" }}
          >
            {Array.from("Klosky").map((char, index) => (
              <motion.span
                key={index}
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{
                  repeat: Infinity,
                  repeatType: "mirror",
                  duration: 2,
                  delay: index * 0.1,
                }}
                style={{ display: "inline-block" }}
              >
                {char}
              </motion.span>
            ))}
          </motion.span>
        </h1>
        <motion.img
          src="/exclamation_mark.svg"
          alt="Exclamation Mark"
          className="absolute right-0 top-1/5 transform -translate-y-1/2" // Moved up
          initial={{ scale: 0, y: 150, x: -50 }}
          animate={{ scale: 0.5 }}
          transition={{ delay: 3, duration: 0.5 }}
        />
      </div>
    </main>
  );
}

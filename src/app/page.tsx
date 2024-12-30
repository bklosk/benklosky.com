"use client";
import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import localFont from "next/font/local";
import Link from "next/link";

const soloviev = localFont({ src: "./Soloviev.otf" });

function createBlob() {
  const random = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min));
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
        transition: { duration: 2 },
      });
    }, 900); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [controls]);

  return (
    <main
      className={`bg-gradient-to-r from-[#C41A17] to-[#E4321B] w-screen h-screen relative`}
    >
      <div className="absolute bottom-0 right-0 w-32 h-16 bg-[#048226] rounded-br-full transform rotate-180" />
      {isClient && (
        <motion.div
          id="blob"
          className="absolute inset-0 m-auto w-[400px] h-[400px] bg-[#820460]" // Made smaller
          animate={controls}
          initial={{ borderRadius: createBlob(), rotate: "0deg" }}
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 100 }}
        />
      )}
      <h1 className="text-[#E5DACB] z-50 text-9xl text-center absolute inset-0 flex items-center justify-center">
        <motion.span
          className={`${soloviev.className} inline-block`}
          initial={{ x: 30, y: -50, rotate: 2 }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.8, rotate: 5 }}
          drag
          dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
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
          initial={{ rotate: -10 }}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.8, rotate: -5 }}
          drag
          dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
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
        className="absolute right-0 m-0 top-[5vw]"
      />
      <Link href="/test" className="absolute top-0 left-0 m-0">
        <motion.img src="/mywork.svg" alt="My work" className="h-64 " />
        <motion.h1
          className={`${soloviev.className} text-[#E5DACB] absolute z-50 top-7 left-6 m-0 text-5xl inline-block`}
          initial={{ rotate: -6 }}
          whileHover={{ scale: 1.1, rotate: -2 }}
          whileTap={{ scale: 0.8, rotate: 2 }}
        >
          Projects
        </motion.h1>
      </Link>
    </main>
  );
}

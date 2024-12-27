"use client";
import { useEffect, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import localFont from "next/font/local";

const soloviev = localFont({ src: "./Soloviev.otf" });

type MetaballProps = {
  x: number;
  y: number;
  size: number;
};

function Metaball({ x, y, size }: MetaballProps) {
  const spring = { damping: 30, stiffness: 2, restDelta: 1 };

  const motionX = useMotionValue(x);
  const motionY = useMotionValue(y);

  const newX = useSpring(motionX, spring);
  const newY = useSpring(motionY, spring);

  useEffect(() => {
    const interval = setInterval(() => {
      const mainbox = document.getElementById("mainbox");
      if (mainbox) {
        const { width, height, left, top } = mainbox.getBoundingClientRect();
        motionX.set(left + Math.random() * width);
        motionY.set(top + Math.random() * height + 100);
      }
    }, Math.random() * 4000 + 50); // Random interval between 2s and 5s

    return () => clearInterval(interval);
  }, [motionX, motionY]);

  const isOval = Math.random() > 0.5;
  const radiusX = isOval ? size * 1.2 : size;
  const radiusY = size;

  return (
    <motion.ellipse
      cx={newX}
      cy={newY}
      rx={radiusX}
      ry={radiusY}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      fill="#820460"
    />
  );
}

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const metaballs = isClient
    ? Array.from({ length: 9 }, () => ({
        x: Math.random() * 0.8 * window.innerWidth,
        y: Math.random() * 0.8 * window.innerHeight,
        size: 100 + Math.random() * 50,
      }))
    : [];

  return (
    <main className={`bg-[#C41A17] min-h-screen h-[1500px] relative`}>
      <div
        id="mainbox"
        className="h-screen w-full absolute overflow-visible pointer-events-none"
      >
        <div className="absolute top-0 left-0 w-32 h-16 bg-green-700 rounded-tl-full transform rotate-180" />
        <div className="absolute bottom-0 right-0 w-32 h-16 bg-green-700 rounded-br-full transform rotate-180" />
        {isClient && (
          <svg className="absolute z-0 w-full h-full">
            <defs>
              <filter id="metaballs">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="8" // Increased resolution
                  result="blur"
                />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -10"
                  result="metaballs"
                />
                <feBlend in="SourceGraphic" in2="metaballs" />
              </filter>
            </defs>
            <g filter="url(#metaballs)">
              {metaballs.map((ball, index) => (
                <Metaball key={index} x={ball.x} y={ball.y} size={ball.size} />
              ))}
            </g>
          </svg>
        )}
        <h1 className="text-[#E5DACB] z-50 text-9xl text-center absolute inset-0 flex items-center justify-center">
          <motion.span
            className={`${soloviev.className} inline-block`}
            initial={{ x: -2000, rotate: 2 }}
            animate={{ x: 0 }}
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
              delay: 1.2,
              duration: 2,
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
      </div>
    </main>
  );
}

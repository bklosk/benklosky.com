"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import localFont from "next/font/local";
// import Metaball from "./metaballs";

const soloviev = localFont({ src: "./Soloviev.otf" });

type MetaballProps = {
  x: number;
  y: number;
  size: number;
};

function Metaball({ x, y, size }: { x: number; y: number; size: number }) {
  const [animationX, setAnimationX] = useState([
    x,
    x + Math.random() * 100 - 50,
    x,
  ]);
  const [animationY, setAnimationY] = useState([
    y,
    y + Math.random() * 100 - 50,
    y,
  ]);

  return (
    <motion.circle
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
      }}
      animate={{ x: animationX, y: animationY }}
      transition={{ repeat: Infinity, repeatType: "loop", duration: 3 }}
      r={size / 2}
    />
  );
}

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const metaballs = [
    { x: 100, y: 100, size: 100 },
    { x: 200, y: 200, size: 150 },
    { x: 300, y: 300, size: 120 },
  ];

  return (
    <main className={`bg-[#C41A17] min-h-screen relative overflow-hidden`}>
      {isClient && (
        <svg className="z-50 absolute inset-0 w-full h-full">
          <defs>
            <filter id="metaballs">
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="30"
                result="blur"
              />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -15"
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
      <div className="flex items-center justify-center h-full w-full absolute inset-0 pointer-events-none">
        <h1 className="text-[#E5DACB] text-9xl text-center">
          <span className={soloviev.className}>Ben Klosky!</span>
        </h1>
      </div>
    </main>
  );
}

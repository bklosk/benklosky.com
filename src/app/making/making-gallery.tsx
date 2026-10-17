"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type Item = {
  src: string;
  kind: "image" | "video";
  width: number;
  height: number;
  label: string;
};

const BASE = "/making";

const ITEMS: Item[] = [
  { src: "IMG_1805.mp4", kind: "video", width: 720, height: 1280, label: "Test driving an electric go-kart" },
  { src: "IMG_4835.webp", kind: "image", width: 1050, height: 1400, label: "Making a bottle opener" },
  { src: "IMG_0855.webp", kind: "image", width: 1400, height: 787, label: "Espresso machine mid-pressure transducer mod" },
  { src: "IMG_8934.mp4", kind: "video", width: 720, height: 1280, label: "Welding in the shipping-container shop" },
  { src: "IMG_0405.webp", kind: "image", width: 787, height: 1400, label: "Keyboard PCB at the soldering bench" },
  { src: "IMG_7182.webp", kind: "image", width: 1400, height: 1050, label: "Making a tote bag from scratch fabric" },
  { src: "IMG_0406.webp", kind: "image", width: 787, height: 1400, label: "Split keyboard finally operational (this one was painful)" },
  { src: "IMG_4863.webp", kind: "image", width: 240, height: 320, label: "Pulling a knife tang out of a 2000 degree forge" },
  { src: "IMG_2309.webp", kind: "image", width: 787, height: 1400, label: "Obviously I own many 3D printers" },
];

function LoopVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  // Muted loops are fine for most people; pause them for anyone who asked for less motion.
  useEffect(() => {
    const video = ref.current;
    if (video && window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.pause();
  }, []);

  return <video ref={ref} src={src} aria-label={label} autoPlay muted loop playsInline preload="metadata" />;
}

export function MakingGallery() {
  return (
    <ul className="making-mosaic">
      {ITEMS.map((item) => {
        const ratio = item.width / item.height;
        return (
          <li
            key={item.src}
            className="making-tile"
            tabIndex={0}
            style={{ "--ratio": ratio } as React.CSSProperties}
          >
            {item.kind === "video" ? (
              <LoopVideo src={`${BASE}/${item.src}`} label={item.label} />
            ) : (
              <Image
                src={`${BASE}/${item.src}`}
                alt={item.label}
                width={item.width}
                height={item.height}
                sizes="(max-width: 640px) 50vw, 280px"
              />
            )}
            <span className="making-tile-label">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

// A looping project clip that shows its poster image right away and swaps to video once frames are playing.
// The poster is a normal optimized image (blur placeholder, cached forever); the video is only fetched when the
// tile is near the viewport, and never for visitors who prefer reduced motion.
import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Props = { src: string; poster: StaticImageData; alt: string; sizes: string; eager?: boolean };

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function ProjectVideo({ src, poster, alt, sizes, eager = false }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [playing, setPlaying] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    const element = frame.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div ref={frame} className={`project-video${playing ? " is-playing" : ""}`}>
      <Image
        src={poster}
        alt={alt}
        sizes={sizes}
        placeholder="blur"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
      {near && !reduced ? (
        <video
          src={src}
          width={poster.width}
          height={poster.height}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onPlaying={() => setPlaying(true)}
        />
      ) : null}
    </div>
  );
}

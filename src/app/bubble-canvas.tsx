"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

type Bubble = {
  x: number;
  y: number;
  color: string;
  radius: number;
  targetRadius: number;
  velocity: number;
  pressedAt: number;
  pressed: boolean;
};

const QUICK_RADIUS = 38;
const MAX_BUBBLES = 40;
const BUBBLE_COLORS = [
  "#172554",
  "#3b122c",
  "#12372d",
  "#451a18",
  "#31205f",
  "#17334d",
];

function paintBubbles(
  canvas: HTMLCanvasElement | null,
  bubbles: Bubble[],
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (const bubble of bubbles) {
    context.fillStyle = bubble.color;
    context.beginPath();
    context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    context.fill();
  }
}

export function BubbleCanvas({ children }: { children: ReactNode }) {
  const shellRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const pointersRef = useRef(new Map<number, Bubble>());
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  function animate(now: number) {
    const elapsed = lastFrameRef.current
      ? Math.min((now - lastFrameRef.current) / 1000, 0.034)
      : 1 / 60;
    lastFrameRef.current = now;

    let isMoving = false;

    for (const bubble of bubblesRef.current) {
      if (bubble.pressed) {
        const holdTime = now - bubble.pressedAt;
        bubble.targetRadius =
          QUICK_RADIUS + 76 * Math.log1p(holdTime / 150);
      }

      const acceleration = (bubble.targetRadius - bubble.radius) * 120;
      bubble.velocity =
        (bubble.velocity + acceleration * elapsed) * Math.exp(-15 * elapsed);
      bubble.radius += bubble.velocity * elapsed;

      if (
        bubble.pressed ||
        Math.abs(bubble.targetRadius - bubble.radius) > 0.08 ||
        Math.abs(bubble.velocity) > 0.08
      ) {
        isMoving = true;
      }
    }

    paintBubbles(canvasRef.current, bubblesRef.current);

    if (isMoving) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      frameRef.current = null;
      lastFrameRef.current = 0;
    }
  }

  function startAnimation() {
    if (frameRef.current === null) {
      lastFrameRef.current = 0;
      frameRef.current = requestAnimationFrame(animate);
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("a")) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const bounds = event.currentTarget.getBoundingClientRect();
    const bubble: Bubble = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      color:
        BUBBLE_COLORS[
          Math.floor(Math.random() * BUBBLE_COLORS.length)
        ],
      radius: 8,
      targetRadius: QUICK_RADIUS,
      velocity: 220,
      pressedAt: performance.now(),
      pressed: true,
    };

    bubblesRef.current.push(bubble);
    if (bubblesRef.current.length > MAX_BUBBLES) {
      bubblesRef.current.shift();
    }
    pointersRef.current.set(event.pointerId, bubble);
    startAnimation();
  };

  const releasePointer = (event: ReactPointerEvent<HTMLElement>) => {
    const bubble = pointersRef.current.get(event.pointerId);
    if (!bubble) return;

    bubble.pressed = false;
    bubble.targetRadius += 10;
    bubble.velocity += 55;
    pointersRef.current.delete(event.pointerId);
    startAnimation();
  };

  useEffect(() => {
    const shell = shellRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = shell.clientWidth;
      const height = shell.clientHeight;

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      paintBubbles(canvas, bubblesRef.current);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    resize();

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <main
      ref={shellRef}
      className="site-shell bubble-surface"
      onPointerDown={handlePointerDown}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
    >
      <canvas ref={canvasRef} className="bubble-canvas" aria-hidden="true" />
      {children}
    </main>
  );
}

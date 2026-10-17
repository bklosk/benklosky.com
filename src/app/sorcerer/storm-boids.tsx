"use client";

import { useEffect, useRef } from "react";

const COLS = 72;
const ROWS = 22;
/** World units per row; character cells are roughly twice as tall as they are wide. */
const ASPECT = 2;
const WORLD_W = COLS;
const WORLD_H = ROWS * ASPECT;

const RAMP = " .:-=+*#%@";
const GREYS = Array.from({ length: RAMP.length }, (_, i) => {
  const k = i / (RAMP.length - 1);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k);
  return `rgb(${mix(206, 72)}, ${mix(201, 69)}, ${mix(192, 64)})`;
});
const GRID = "#e2ded6";
const INK = "#1b1a18";

const BOID_COUNT = 30;
const STORM_RADIUS = 13;
const MAX_SPEED = 10;
const MIN_SPEED = 5;

type Boid = { x: number; y: number; vx: number; vy: number };

const GLYPHS = [">", "\\", "v", "/", "<", "\\", "^", "/"];

function glyph(boid: Boid) {
  const sector = Math.round(Math.atan2(boid.vy, boid.vx) / (Math.PI / 4));
  return GLYPHS[(sector + 8) % 8];
}

function wrap(value: number, size: number) {
  return ((value % size) + size) % size;
}

function stormIntensity(x: number, y: number, sx: number, sy: number, t: number) {
  const dx = x - sx;
  const dy = y - sy;
  const r = Math.hypot(dx, dy) / STORM_RADIUS;
  if (r > 1.6) return 0;
  const theta = Math.atan2(dy, dx);
  const body = Math.exp(-r * r * 1.6);
  const arms = 0.55 + 0.45 * Math.sin(2 * theta + r * 6 - t * 1.8);
  const eye = Math.min(1, Math.max(0, (r - 0.06) / 0.16));
  return body * arms * eye;
}

export function StormBoids() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cellW = 0;
    let cellH = 0;
    let fontSize = 0;

    const storm = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };
    let pointer: { x: number; y: number } | null = null;
    let t = 0;

    const boids: Boid[] = [];
    while (boids.length < BOID_COUNT) {
      const x = Math.random() * WORLD_W;
      const y = Math.random() * WORLD_H;
      if (Math.hypot(x - storm.x, y - storm.y) < STORM_RADIUS * 1.2) continue;
      const angle = (Math.random() - 0.5) * 1.2;
      boids.push({ x, y, vx: Math.cos(angle) * MIN_SPEED, vy: Math.sin(angle) * MIN_SPEED });
    }

    const resize = () => {
      const width = canvas.clientWidth;
      if (!width) return;
      const dpr = window.devicePixelRatio || 1;
      cellW = width / COLS;
      fontSize = cellW / 0.6;
      cellH = fontSize * 1.15;
      const height = cellH * ROWS;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const step = (dt: number) => {
      t += dt;

      const target = pointer ?? {
        x: WORLD_W * (0.5 + 0.3 * Math.sin(t * 0.13)),
        y: WORLD_H * (0.5 + 0.22 * Math.sin(t * 0.21 + 1)),
      };
      const ease = Math.min(1, dt * (pointer ? 2.5 : 0.6));
      storm.x += (target.x - storm.x) * ease;
      storm.y += (target.y - storm.y) * ease;

      for (const boid of boids) {
        let ax = 0;
        let ay = 0;
        let alignX = 0;
        let alignY = 0;
        let centerX = 0;
        let centerY = 0;
        let neighbors = 0;

        for (const other of boids) {
          if (other === boid) continue;
          let dx = other.x - boid.x;
          let dy = other.y - boid.y;
          dx -= WORLD_W * Math.round(dx / WORLD_W);
          dy -= WORLD_H * Math.round(dy / WORLD_H);
          const d = Math.hypot(dx, dy);
          if (d > 7) continue;
          neighbors++;
          alignX += other.vx;
          alignY += other.vy;
          centerX += dx;
          centerY += dy;
          if (d < 2.4 && d > 0) {
            ax -= (dx / d) * (2.4 - d) * 6;
            ay -= (dy / d) * (2.4 - d) * 6;
          }
        }

        if (neighbors) {
          ax += (alignX / neighbors - boid.vx) * 0.9;
          ay += (alignY / neighbors - boid.vy) * 0.9;
          ax += (centerX / neighbors) * 0.25;
          ay += (centerY / neighbors) * 0.25;
        }

        const sdx = boid.x - storm.x;
        const sdy = boid.y - storm.y;
        const sd = Math.hypot(sdx, sdy) || 0.001;
        const reach = STORM_RADIUS * 1.7;
        if (sd < reach) {
          const push = (1 - sd / reach) ** 2 * 260;
          ax += (sdx / sd) * push;
          ay += (sdy / sd) * push;
          // Bias toward sliding around the cell rather than bouncing straight back.
          const side = Math.sign(boid.vx * sdy - boid.vy * sdx) || 1;
          ax += (-sdy / sd) * side * push * 0.5;
          ay += (sdx / sd) * side * push * 0.5;
        }

        ax += 0.5;

        boid.vx += ax * dt;
        boid.vy += ay * dt;
        const speed = Math.hypot(boid.vx, boid.vy) || 0.001;
        const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
        boid.vx = (boid.vx / speed) * clamped;
        boid.vy = (boid.vy / speed) * clamped;
        boid.x = wrap(boid.x + boid.vx * dt, WORLD_W);
        boid.y = wrap(boid.y + boid.vy * dt, WORLD_H);
      }
    };

    const draw = () => {
      if (!cellW) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";

      const occupied = new Map<number, Boid>();
      for (const boid of boids) {
        const col = Math.floor(boid.x);
        const row = Math.floor(boid.y / ASPECT);
        occupied.set(row * COLS + col, boid);
      }

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const px = col * cellW;
          const py = row * cellH;
          const boid = occupied.get(row * COLS + col);
          if (boid) {
            ctx.fillStyle = INK;
            ctx.fillText(glyph(boid), px, py);
            continue;
          }
          const intensity = stormIntensity(col + 0.5, (row + 0.5) * ASPECT, storm.x, storm.y, t);
          const level = Math.min(RAMP.length - 1, Math.round(intensity * (RAMP.length - 1) * 1.15));
          if (level > 0) {
            ctx.fillStyle = GREYS[level];
            ctx.fillText(RAMP[level], px, py);
          } else if (col % 6 === 0 && row % 3 === 0) {
            ctx.fillStyle = GRID;
            ctx.fillText("+", px, py);
          }
        }
      }
    };

    const toWorld = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
        y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer = toWorld(event);
      if (reduceMotion) {
        storm.x = pointer.x;
        storm.y = pointer.y;
        draw();
      }
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let frame = 0;
    let last = 0;
    let visible = true;
    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      step(dt);
      draw();
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduceMotion || frame || !visible) return;
      last = 0;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    intersectionObserver.observe(canvas);

    if (reduceMotion) {
      for (let i = 0; i < 240; i++) step(1 / 30);
    }
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <figure className="sorcerer-figure">
      <canvas
        ref={canvasRef}
        className="sorcerer-storm"
        role="img"
        aria-label="An ASCII simulation of a flock of delivery drones rerouting around a rotating storm cell"
      />
    </figure>
  );
}

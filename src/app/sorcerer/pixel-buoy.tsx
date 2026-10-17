"use client";

import { useEffect, useRef } from "react";

const W = 112;
const H = 84;
const FPS = 12;

const CX = 56;
const CY = 54;
const HALF_W = 42;
const HALF_H = 21;
const DEPTH = 12;

function rgba(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((255 << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
}

const C = {
  waterDeep: rgba("#5b8aa3"),
  water: rgba("#6d9db5"),
  waterLight: rgba("#86b3c8"),
  foam: rgba("#e6f0f2"),
  shadow: rgba("#4d7b94"),
  sideLeft: rgba("#3f6a80"),
  sideLeftDeep: rgba("#355b6e"),
  sideRight: rgba("#2f5466"),
  sideRightDeep: rgba("#274757"),
  rim: rgba("#a9cbd8"),
  line: rgba("#cfcac1"),
  packet: rgba("#c96f45"),
  lightOn: rgba("#ffcf5a"),
  halo: rgba("#ffe7a3"),
};

const PALETTE: Record<string, number> = {
  k: rgba("#3a3834"),
  o: rgba("#c96f45"),
  O: rgba("#a5532f"),
  w: rgba("#f4f1ea"),
  W: rgba("#d8d3c9"),
  d: rgba("#5a5550"),
  D: rgba("#3a3834"),
  g: rgba("#8d887f"),
  s: rgba("#33475b"),
  S: rgba("#5d7d99"),
  L: rgba("#8d887f"),
};

const BUOY = [
  ".....L.....",
  ".....g.....",
  "..g..g..g..",
  "..ggggggg..",
  ".....g.....",
  "...sssss...",
  "...sSSSs...",
  ".....g.....",
  ".....g.....",
  "..kkkkkkk..",
  ".kooooooOk.",
  ".kwwwwwwWk.",
  "kooooooooOk",
  "kddddddddDk",
];
const SPIN = "...g.g.g...";

const SATELLITE = ["ss.k.ss", "SSkkkSS", "ss.k.ss"];

export function PixelBuoy() {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const figure = figureRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    canvas.width = W;
    canvas.height = H;
    const image = ctx.createImageData(W, H);
    const buf = new Uint32Array(image.data.buffer);

    const px = (x: number, y: number, color: number) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      buf[y * W + x] = color;
    };

    const onTop = (x: number, y: number) => Math.abs(x - CX) / HALF_W + Math.abs(y - CY) / HALF_H <= 1;

    const sprite = (rows: string[], left: number, top: number, colors: Record<string, number>) => {
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const color = colors[row[i]];
          if (color !== undefined) px(left + i, top + j, color);
        }
      });
    };

    const draw = (t: number) => {
      buf.fill(0);

      for (let x = CX - HALF_W; x <= CX + HALF_W; x++) {
        const edge = Math.floor(CY + HALF_H * (1 - Math.abs(x - CX) / HALF_W));
        const left = x < CX;
        for (let k = 1; k <= DEPTH; k++) {
          const deep = k > DEPTH * 0.55;
          let color = left ? (deep ? C.sideLeftDeep : C.sideLeft) : deep ? C.sideRightDeep : C.sideRight;
          if (k === 1) color = C.rim;
          px(x, edge + k, color);
        }
      }

      for (let y = CY - HALF_H; y <= CY + HALF_H; y++) {
        for (let x = CX - HALF_W; x <= CX + HALF_W; x++) {
          if (!onTop(x, y)) continue;
          const u = (x - CX) / HALF_W + (y - CY) / HALF_H;
          const v = (y - CY) / HALF_H - (x - CX) / HALF_W;
          const wave = Math.sin(u * 9 + t * 1.6) + 0.7 * Math.sin(v * 13 - t * 1.1);
          let color = C.water;
          if (wave > 1.6) color = C.foam;
          else if (wave > 0.9) color = C.waterLight;
          else if (wave < -1.1) color = C.waterDeep;
          px(x, y, color);
        }
      }

      const bob = Math.round(Math.sin(t * 2.2));
      const base = CY + 2 + bob;

      for (let i = -6; i <= 6; i++) {
        for (let j = -2; j <= 2; j++) {
          if ((i * i) / 36 + (j * j) / 4 <= 1) px(CX + i, CY + 3 + j, C.shadow);
        }
      }

      for (let n = 0; n < 2; n++) {
        const phase = (t / 2.4 + n / 2) % 1;
        const r = 8 + phase * 16;
        const steps = Math.round(r * 4);
        for (let s = 0; s < steps; s++) {
          if (s % 3 && phase > 0.5) continue;
          const a = (s / steps) * Math.PI * 2;
          const x = CX + Math.cos(a) * r;
          const y = CY + 3 + Math.sin(a) * r * 0.5;
          if (onTop(x, y)) px(x, y, C.foam);
        }
      }

      const top = base - BUOY.length + 1;
      const left = CX - Math.floor(BUOY[0].length / 2);
      const frame = Math.floor(t * FPS);
      const rows = BUOY.slice();
      if (frame % 2) rows[2] = SPIN;
      const lightOn = Math.floor(t * 1.4) % 2 === 0;
      sprite(rows, left, top, { ...PALETTE, L: lightOn ? C.lightOn : PALETTE.L });
      if (lightOn) {
        px(CX - 1, top, C.halo);
        px(CX + 1, top, C.halo);
        px(CX, top - 1, C.halo);
      }

      for (let i = -5; i <= 5; i++) {
        if ((i + frame) % 3 === 0) continue;
        px(CX + i, base + 1 + (Math.abs(i) < 4 ? 0 : -1), C.foam);
      }

      const pass = (t / 16) % 1;
      const sx = -12 + pass * (W + 24);
      const sy = 14 - Math.sin(pass * Math.PI) * 7;
      sprite(SATELLITE, sx - 3, sy - 1, PALETTE);

      const ax = CX;
      const ay = top - 2;
      const linked = sx > 14 && sx < W - 14;
      if (linked) {
        const dx = sx - ax;
        const dy = sy + 2 - ay;
        const length = Math.hypot(dx, dy);
        for (let d = 2; d < length - 3; d += 3) px(ax + (dx * d) / length, ay + (dy * d) / length, C.line);
        for (let p = 0; p < 3; p++) {
          const f = (t * 0.9 + p / 3) % 1;
          const x = ax + dx * f;
          const y = ay + dy * f;
          px(x, y, C.packet);
          px(x + 1, y, C.packet);
          px(x, y + 1, C.packet);
          px(x + 1, y + 1, C.packet);
        }
        if (frame % 6 < 3) px(sx, sy - 2, C.lightOn);
      }

      ctx.putImageData(image, 0, 0);
    };

    const resize = () => {
      const scale = Math.max(1, Math.floor(figure.clientWidth / W));
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(figure);
    resize();

    let raf = 0;
    let lastFrame = -1;
    let visible = true;
    const startedAt = performance.now();
    const loop = (now: number) => {
      const frame = Math.floor(((now - startedAt) / 1000) * FPS);
      if (frame !== lastFrame) {
        lastFrame = frame;
        draw(frame / FPS);
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduceMotion || raf || !visible) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    intersectionObserver.observe(canvas);

    draw(5);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  return (
    <figure ref={figureRef} className="sorcerer-figure">
      <canvas
        ref={canvasRef}
        className="sorcerer-buoy"
        role="img"
        aria-label="A pixel art buoy bobbing in the ocean, uplinking data to a passing satellite"
      />
    </figure>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Word = { word: string; v: THREE.Vector3 };

// Real embeddings have hundreds of dimensions. These seven are hand-placed in
// three, so that foods, sports, and animals each point their own way.
const WORDS: Word[] = (
  [
    ["pizza", 1, 0.2, -0.15],
    ["pasta", 0.9, 0.45, 0.15],
    ["running", -0.2, 1, -0.2],
    ["swimming", 0, 0.8, 0.55],
    ["fish", 0.1, 0.35, 0.95],
    ["dog", -0.45, 0.1, 0.95],
    ["cat", -0.6, -0.1, 0.85],
  ] as const
).map(([word, x, y, z]) => ({ word, v: new THREE.Vector3(x, y, z).normalize() }));

const FAR = new THREE.Color("#cfcac1");
const NEAR = new THREE.Color("#c96f45");
const SECRET = new THREE.Color("#1b1a18");
const GUIDE = "#e4e0d8";

/** Cosine similarity, scaled by 100 like the game shows it. */
const score = (a: Word, b: Word) => a.v.dot(b.v) * 100;

function circle(axis: "x" | "y" | "z") {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const [c, s] = [Math.cos(t), Math.sin(t)];
    points.push(axis === "x" ? new THREE.Vector3(0, c, s) : axis === "y" ? new THREE.Vector3(c, 0, s) : new THREE.Vector3(c, s, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

type Scene = { setSecret: (index: number | null) => void };

export function WordEmbedding() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sceneRef = useRef<Scene | null>(null);
  const moved = useRef(false);
  const [secret, setSecret] = useState<number | null>(5);
  const secretRef = useRef(secret);

  useEffect(() => {
    secretRef.current = secret;
    sceneRef.current?.setSecret(secret);
  }, [secret]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 4.1);

    const world = new THREE.Group();
    world.rotation.set(0.7, 1.8, 0);
    scene.add(world);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    // Faint guides: three great circles make the sphere readable as 3D.
    const guideMaterial = track(new THREE.LineBasicMaterial({ color: GUIDE }));
    for (const axis of ["x", "y", "z"] as const) world.add(new THREE.Line(track(circle(axis)), guideMaterial));

    const origin = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.025, 12, 12)),
      track(new THREE.MeshBasicMaterial({ color: "#8d887f" })),
    );
    world.add(origin);

    const tipGeometry = track(new THREE.SphereGeometry(0.045, 16, 16));
    const stems = WORDS.map(({ v }) => {
      const material = track(new THREE.LineBasicMaterial({ color: FAR }));
      const line = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), v])), material);
      const tipMaterial = track(new THREE.MeshBasicMaterial({ color: FAR }));
      const tip = new THREE.Mesh(tipGeometry, tipMaterial);
      tip.position.copy(v);
      world.add(line, tip);
      return { material, tipMaterial, tip };
    });

    const setSecret = (index: number | null) => {
      WORDS.forEach((word, i) => {
        const color =
          index === null
            ? FAR.clone()
            : i === index
              ? SECRET.clone()
              : FAR.clone().lerp(NEAR, Math.min(1, Math.max(0, score(word, WORDS[index]) / 100)));
        stems[i].material.color.copy(color);
        stems[i].tipMaterial.color.copy(color);
        stems[i].tip.scale.setScalar(i === index ? 1.5 : 1);
      });
    };
    sceneRef.current = { setSecret };
    setSecret(secretRef.current);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { spin: reduceMotion ? 0 : 0.12, vx: 0, vy: 0, dragging: false, x: 0, y: 0, width: 0, height: 0 };

    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      state.width = width;
      state.height = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const down = (event: PointerEvent) => {
      state.dragging = true;
      state.spin = 0;
      state.x = event.clientX;
      state.y = event.clientY;
      moved.current = false;
    };
    const move = (event: PointerEvent) => {
      if (!state.dragging) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      if (!moved.current) {
        moved.current = true;
        // Capture only once it is a drag, so plain clicks still reach the word buttons.
        stage.setPointerCapture(event.pointerId);
      }
      state.x = event.clientX;
      state.y = event.clientY;
      world.rotation.y += dx * 0.008;
      world.rotation.x = Math.max(-1.3, Math.min(1.3, world.rotation.x + dy * 0.008));
      state.vy = dx * 0.008;
      state.vx = dy * 0.008;
    };
    const up = (event: PointerEvent) => {
      state.dragging = false;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    };
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);

    const projected = new THREE.Vector3();
    let frame = 0;
    let last = performance.now();
    let visible = true;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!state.dragging) {
        world.rotation.y += state.vy + state.spin * dt;
        world.rotation.x = Math.max(-1.3, Math.min(1.3, world.rotation.x + state.vx));
        state.vx *= 0.94;
        state.vy *= 0.94;
      }
      world.updateMatrixWorld();
      renderer.render(scene, camera);

      WORDS.forEach(({ v }, i) => {
        const label = labelRefs.current[i];
        if (!label) return;
        projected.copy(v).multiplyScalar(1.1).applyMatrix4(world.matrixWorld);
        const depth = projected.z;
        projected.project(camera);
        const x = (projected.x * 0.5 + 0.5) * state.width;
        const y = (-projected.y * 0.5 + 0.5) * state.height;
        label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        // Labels on the far side of the sphere fade back.
        label.style.opacity = String(depth < -0.1 ? 0.4 : 1);
      });
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else cancelAnimationFrame(frame);
    });
    visibility.observe(stage);
    if (visible) start();

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      observer.disconnect();
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  const chosen = secret === null ? null : WORDS[secret];

  return (
    <figure className="windborne-figure">
      <div className="windborne-embedding" ref={stageRef}>
        <canvas ref={canvasRef} aria-hidden="true" />
        {WORDS.map((word, i) => (
          <button
            key={word.word}
            ref={(node) => {
              labelRefs.current[i] = node;
            }}
            type="button"
            className={`windborne-word${secret === i ? " is-secret" : ""}`}
            aria-pressed={secret === i}
            onClick={() => {
              if (!moved.current) setSecret(secret === i ? null : i);
            }}
          >
            <span>{word.word}</span>
            {chosen && secret !== i && <small>{score(word, chosen).toFixed(1)}</small>}
          </button>
        ))}
      </div>
      <figcaption className="windborne-caption">
        Seven words as vectors from the origin. Drag to rotate, and click a word to make it the secret
        word. Every other word shows its similarity to it (the cosine of the angle between the
        vectors, times 100): words that point the same way score high. Real embeddings use hundreds of
        dimensions, not three.
      </figcaption>
    </figure>
  );
}

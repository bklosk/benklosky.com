"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import * as THREE from "three";
import publisherSpines from "./data/publisher-spines.json";
import { allBoxes, type ShelfBox } from "./shelf-layout";
import type { Game, Selection } from "./types";

const publisherTexture = new Map(publisherSpines.map(({ key, output }) => [key, output]));
const INITIAL_ROTATION = { x: -5, y: -11 };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const scale = 0.5;

type ShelfScene = {
  camera: THREE.PerspectiveCamera;
  world: THREE.Group;
  boxMeshes: THREE.Mesh[];
  materials: THREE.MeshBasicMaterial[][];
  raycaster: THREE.Raycaster;
  render: () => void;
};

function faceMaterials(color: string, front = color) {
  const tint = (factor: number) => new THREE.Color(color).multiplyScalar(factor);
  return [
    new THREE.MeshBasicMaterial({ color: tint(0.85) }),
    new THREE.MeshBasicMaterial({ color: tint(0.9) }),
    new THREE.MeshBasicMaterial({ color: tint(1.06) }),
    new THREE.MeshBasicMaterial({ color: tint(0.72) }),
    new THREE.MeshBasicMaterial({ color: front }),
    new THREE.MeshBasicMaterial({ color: tint(0.88) }),
  ];
}

function addCuboid(scene: THREE.Group, x: number, y: number, w: number, h: number, d = 128, z = 0, color = "#e9e8dc") {
  const materials = faceMaterials(color);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
  mesh.position.set(x + w / 2 - 300, 300 - y - h / 2, z);
  scene.add(mesh);
  return mesh;
}

function loadSpines(boxes: ShelfBox[], meshes: THREE.Mesh[], render: () => void, disposed: () => boolean) {
  const sources = new Map<string, Promise<HTMLImageElement>>();
  const getImage = (src: string) => {
    if (!sources.has(src)) {
      sources.set(src, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      }));
    }
    return sources.get(src)!;
  };

  boxes.forEach((box, index) => {
    const publisher = publisherTexture.get(box.key);
    const src = publisher ?? (box.photoRect ? "/shelf/top.webp" : "/shelf/spines.webp");
    getImage(src).then((image) => {
      if (disposed()) return;
      const [x, y, w, h] = box.photoRect ?? box.rect;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(box.rect[2]));
      canvas.height = Math.max(1, Math.round(box.rect[3]));
      const context = canvas.getContext("2d");
      if (!context) return;
      if (publisher) context.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
      else {
        const referenceWidth = box.photoRect ? 2000 : 1200;
        const referenceHeight = box.photoRect ? 1500 : 1200;
        context.drawImage(image,
          x * image.width / referenceWidth, y * image.height / referenceHeight,
          w * image.width / referenceWidth, h * image.height / referenceHeight,
          0, 0, canvas.width, canvas.height);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const front = (meshes[index].material as THREE.MeshBasicMaterial[])[4];
      front.color.set("#ffffff");
      front.map = texture;
      front.needsUpdate = true;
      render();
    }).catch(() => {});
  });
}

export function ShelfModel({ games, selectedId, matchedIds, searching, onSelect }: {
  games: Game[];
  selectedId?: number;
  matchedIds: Set<number>;
  searching: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShelfScene | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ x: 0, y: 0, moved: false });
  const suppressClickUntil = useRef(0);
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(0.8);
  const [dragging, setDragging] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const byId = new Map(games.map((game) => [game.id, game]));

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    stage.prepend(renderer.domElement);
    renderer.domElement.className = "shelf-canvas";

    const camera = new THREE.PerspectiveCamera(25, 1, 1, 4000);
    camera.position.z = 1700;
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    scene.add(world);
    const materials: THREE.MeshBasicMaterial[][] = [];
    const boxMeshes = allBoxes.map((box, index) => {
      const [x, y, w, h] = box.rect;
      const depth = box.top ? 100 : 95 + (x % 13);
      const z = (128 - depth) / 2 - (box.top ? 0 : 3);
      const mesh = addCuboid(world, (box.displayX ?? x) * scale, y * scale, w * scale, h * scale, depth, z, box.color);
      mesh.userData.boxIndex = index;
      materials.push(mesh.material as THREE.MeshBasicMaterial[]);
      return mesh;
    });

    // Closed, opaque meshes use the GPU depth buffer; boxes cannot paint over a
    // nearer cubby wall when the entire shelf is rotating.
    const uprights = [0, 122, 240.5, 358, 473.5, 591];
    const widths = [10, 6, 6, 6, 6, 9];
    uprights.forEach((x, i) => addCuboid(world, x, 0, widths[i], 600));
    [0, 123, 240.5, 358, 473.5, 590].forEach((y, row) => {
      const height = row === 0 || row === 5 ? 10 : 6;
      uprights.slice(0, -1).forEach((x, i) => {
        const left = x + widths[i];
        addCuboid(world, left, y, uprights[i + 1] - left, height);
      });
    });
    addCuboid(world, 128, 299, 112.5, 5);
    addCuboid(world, 364, 299, 109.5, 5);
    [247, 302].forEach((y) => {
      addCuboid(world, 247, y, 110, 54, 120, 4, "#dcded0");
      const knob = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8), new THREE.MeshBasicMaterial({ color: "#eeeee1" }));
      knob.position.set(247 + 55 - 300, 300 - y - 27, 66);
      world.add(knob);
    });

    let disposed = false;
    let frame = 0;
    const render = () => {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };
    const shelfScene: ShelfScene = { camera, world, boxMeshes, materials, raycaster: new THREE.Raycaster(), render };
    sceneRef.current = shelfScene;
    loadSpines(allBoxes, boxMeshes, render, () => disposed);

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = 2 * Math.atan(height / (2 * 1700)) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      world.position.y = window.matchMedia("(max-width: 560px)").matches ? -60 : -74;
      setFit(Math.min((width - 65) / 740, (height - 235) / 810, 1.15));
      render();
    });
    observer.observe(stage);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      sceneRef.current = null;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const meshes = Array.isArray(object.material) ? object.material : [object.material];
        meshes.forEach((material) => {
          if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const shelf = sceneRef.current;
    if (!shelf) return;
    shelf.world.scale.setScalar(fit * zoom);
    shelf.world.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), 0, "XYZ");
    allBoxes.forEach((box, index) => {
      const active = box.gameId != null && box.gameId === selectedId;
      const depth = box.top ? 100 : 95 + (box.rect[0] % 13);
      shelf.boxMeshes[index].position.z = (128 - depth) / 2 - (box.top ? 0 : 3) + (active ? 22 : 0);
      shelf.materials[index][4].color.set(
        focusedIndex === index ? "#ffe09b" : active ? "#fff0cb" : shelf.materials[index][4].map ? "#ffffff" : box.color,
      );
      const opacity = searching && (box.gameId === null || !matchedIds.has(box.gameId)) ? 0.23 : 1;
      shelf.materials[index].forEach((material) => {
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity === 1;
      });
    });
    shelf.render();
  }, [fit, zoom, rotation, selectedId, searching, matchedIds, focusedIndex]);

  function hitBox(event: MouseEvent<HTMLDivElement>) {
    const shelf = sceneRef.current;
    const stage = stageRef.current;
    if (!shelf || !stage) return null;
    const rect = stage.getBoundingClientRect();
    shelf.raycaster.setFromCamera(new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    ), shelf.camera);
    const hits = shelf.raycaster.intersectObjects(shelf.world.children, false);
    const index = hits[0]?.object.userData.boxIndex;
    return typeof index === "number" ? allBoxes[index] : null;
  }

  function selectBox(box: ShelfBox) {
    onSelect({ game: box.gameId ? byId.get(box.gameId) ?? null : null, label: box.label, location: box.location });
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.timeStamp < suppressClickUntil.current || event.target instanceof HTMLButtonElement) return;
    const box = hitBox(event);
    if (box) selectBox(box);
  }

  function reset() { setRotation(INITIAL_ROTATION); setZoom(1); }
  function endPointer(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (drag.current.moved) suppressClickUntil.current = event.timeStamp + 150;
    if (pointers.current.size === 0) {
      setDragging(false);
      event.currentTarget.style.cursor = "";
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="shelf-stage-wrapper">
      <div
        className={`shelf-stage ${dragging ? "is-dragging" : ""}`}
        ref={stageRef}
        role="group"
        aria-label="Interactive 3D KALLAX shelf. Drag to rotate, pinch to zoom, or use arrow keys and plus or minus. Tab to a game and press Enter to open its details."
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) event.preventDefault();
          if (event.key === "ArrowLeft") setRotation((r) => ({ ...r, y: clamp(r.y - 5, -45, 45) }));
          if (event.key === "ArrowRight") setRotation((r) => ({ ...r, y: clamp(r.y + 5, -45, 45) }));
          if (event.key === "ArrowUp") setRotation((r) => ({ ...r, x: clamp(r.x - 5, -25, 15) }));
          if (event.key === "ArrowDown") setRotation((r) => ({ ...r, x: clamp(r.x + 5, -25, 15) }));
          if (event.key === "+" || event.key === "=") setZoom((z) => clamp(z + 0.15, 0.65, 1.7));
          if (event.key === "-") setZoom((z) => clamp(z - 0.15, 0.65, 1.7));
          if (event.key === "0") reset();
        }}
        onClick={handleClick}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
          if (pointers.current.size > 1) drag.current.moved = true;
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) {
            event.currentTarget.style.cursor = hitBox(event) ? "pointer" : "";
            return;
          }
          const next = { x: event.clientX, y: event.clientY };
          if (!drag.current.moved && Math.hypot(next.x - drag.current.x, next.y - drag.current.y) < 5) return;
          drag.current.moved = true;
          setDragging(true);
          event.currentTarget.style.cursor = "grabbing";
          event.currentTarget.setPointerCapture(event.pointerId);
          if (pointers.current.size === 2) {
            const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
            if (other) {
              const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
              const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
              if (oldDistance > 0) setZoom((z) => clamp(z * newDistance / oldDistance, 0.65, 1.7));
            }
          } else {
            setRotation((r) => ({ x: clamp(r.x - (next.y - previous.y) * 0.18, -25, 15), y: clamp(r.y + (next.x - previous.x) * 0.22, -45, 45) }));
          }
          pointers.current.set(event.pointerId, next);
        }}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) endPointer(event); }}
      >
        <div className="shelf-floor-shadow" style={{ transform: `translateX(-50%) scale(${fit * zoom})` }} />
        <div className="shelf-game-controls">
          {allBoxes.map((box, index) => (
            <button key={box.key} type="button"
              aria-label={`${box.label ?? (box.gameId ? byId.get(box.gameId)?.name : null) ?? "Unidentified box"} — ${box.location}`}
              aria-pressed={box.gameId != null && selectedId === box.gameId}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              onClick={() => selectBox(box)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

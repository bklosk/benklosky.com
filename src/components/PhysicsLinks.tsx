"use client";

import { Bodies, Body, Composite, Engine } from "matter-js";
import { FileText, Mail, PenLine, UserRound } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

type LinkItem = {
  label: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
};

function GithubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.24c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.58-.3-5.29-1.29-5.29-5.69 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.47.11-3.06 0 0 .98-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.75.81 1.2 1.84 1.2 3.1 0 4.42-2.72 5.39-5.31 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
      />
    </svg>
  );
}

function LinkedinMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M5.37 7.54H1.85V22h3.52V7.54ZM3.61 1.5a2.06 2.06 0 1 0 0 4.12 2.06 2.06 0 0 0 0-4.12ZM22.15 13.71c0-4.36-2.33-6.39-5.44-6.39a4.69 4.69 0 0 0-4.25 2.34V7.54H8.94V22h3.52v-7.16c0-1.89.36-3.72 2.7-3.72 2.31 0 2.34 2.16 2.34 3.84V22h3.52l1.13-8.29Z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.73L8.44 4.05H6.58L17.8 19.84Z"
      />
    </svg>
  );
}

const links: LinkItem[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ben-klosky",
    icon: <LinkedinMark />,
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/bklosk",
    icon: <GithubMark />,
    external: true,
  },
  {
    label: "X",
    href: "https://x.com/benklosky",
    icon: <XMark />,
    external: true,
  },
  {
    label: "Email",
    href: "mailto:benklosky@uchicago.edu",
    icon: <Mail aria-hidden="true" />,
  },
  {
    label: "Writing",
    href: "#writing",
    icon: <PenLine aria-hidden="true" />,
  },
  {
    label: "Resume",
    href: "/resume.pdf",
    icon: <FileText aria-hidden="true" />,
  },
  {
    label: "About",
    href: "#about",
    icon: <UserRound aria-hidden="true" />,
  },
];

type DragState = {
  body: Matter.Body;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

export function PhysicsLinks() {
  const stageRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const bodiesRef = useRef<(Matter.Body | undefined)[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const engine = Engine.create();
    engine.gravity.y = 0.9;

    let frame = 0;
    let previousTime = performance.now();
    let walls: Matter.Body[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const dimensions = () => {
      const rect = stage.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        radius: rect.width < 480 ? 39 : 49,
      };
    };

    const rebuildWalls = () => {
      Composite.remove(engine.world, walls);
      const { width, height } = dimensions();
      const thickness = 120;
      walls = [
        Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, {
          isStatic: true,
        }),
        Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, {
          isStatic: true,
        }),
        Bodies.rectangle(
          width + thickness / 2,
          height / 2,
          thickness,
          height * 2,
          { isStatic: true },
        ),
      ];
      Composite.add(engine.world, walls);

      const { radius } = dimensions();
      bodiesRef.current.forEach((body) => {
        if (!body) return;
        Body.setPosition(body, {
          x: Math.min(Math.max(body.position.x, radius), width - radius),
          y: Math.min(body.position.y, height - radius),
        });
      });
    };

    rebuildWalls();
    const resizeObserver = new ResizeObserver(rebuildWalls);
    resizeObserver.observe(stage);

    links.forEach((_, index) => {
      const timer = setTimeout(() => {
        const { width, radius } = dimensions();
        const availableWidth = Math.max(width - radius * 2, 1);
        const body = Bodies.circle(
          radius + ((index * 83) % availableWidth),
          radius + 12 + (index % 3) * radius * 0.35,
          radius,
          {
            restitution: 0.46,
            friction: 0.24,
            frictionAir: 0.012,
          },
        );
        bodiesRef.current[index] = body;
        Composite.add(engine.world, body);

        const element = linkRefs.current[index];
        if (element) {
          element.style.setProperty("--ball-size", `${radius * 2}px`);
          element.dataset.visible = "true";
        }
      }, 180 * index);
      timers.push(timer);
    });

    const update = (time: number) => {
      Engine.update(engine, Math.min(time - previousTime, 32));
      previousTime = time;

      bodiesRef.current.forEach((body, index) => {
        const element = linkRefs.current[index];
        if (!body || !element) return;
        const radius = body.circleRadius ?? 0;
        element.style.transform = `translate3d(${body.position.x - radius}px, ${
          body.position.y - radius
        }px, 0) rotate(${body.angle}rad)`;
      });

      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
      Engine.clear(engine);
      bodiesRef.current = [];
    };
  }, []);

  const handlePointerDown =
    (index: number) => (event: ReactPointerEvent<HTMLAnchorElement>) => {
      const body = bodiesRef.current[index];
      const stage = stageRef.current;
      if (!body || !stage) return;

      const rect = stage.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      dragRef.current = {
        body,
        pointerId: event.pointerId,
        offsetX: x - body.position.x,
        offsetY: y - body.position.y,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      Body.setStatic(body, true);
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const handlePointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !stage) return;

    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    drag.moved ||=
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6;
    Body.setPosition(drag.body, {
      x: x - drag.offsetX,
      y: y - drag.offsetY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    Body.setStatic(drag.body, false);
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={stageRef}
      className="physics-links"
      aria-label="Interactive links"
    >
      {links.map((link, index) => (
        <a
          key={link.label}
          ref={(element) => {
            linkRefs.current[index] = element;
          }}
          className="physics-link"
          href={link.href}
          target={link.external ? "_blank" : undefined}
          rel={link.external ? "noreferrer" : undefined}
          aria-label={link.label}
          title={link.label}
          onPointerDown={handlePointerDown(index)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault();
              suppressClickRef.current = false;
            }
          }}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}

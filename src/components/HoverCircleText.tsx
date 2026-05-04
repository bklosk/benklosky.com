"use client";

import type { PointerEvent } from "react";

export function HoverCircleText({ children }: { children: string }) {
  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    event.currentTarget.style.setProperty(
      "--hover-circle-text-x",
      `${event.clientX - rect.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--hover-circle-text-y",
      `${event.clientY - rect.top}px`,
    );
  }

  return (
    <span
      aria-hidden="true"
      className="hover-circle-text"
      onPointerMove={handlePointerMove}
    >
      <span className="hover-circle-text__text">{children}</span>
      <span className="hover-circle-text__circle" />
      <span className="hover-circle-text__text hover-circle-text__text--inverse">
        {children}
      </span>
    </span>
  );
}

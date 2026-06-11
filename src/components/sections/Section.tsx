import type { ReactNode } from "react";

export const panelClass =
  "border border-line bg-panel shadow-[0_1rem_3rem_var(--shadow)]";
export const articleTitleClass =
  "my-2 font-serif text-2xl font-normal leading-snug tracking-[-0.03em] md:text-3xl";
export const bodyTextClass = "leading-relaxed text-muted";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-xs leading-tight tracking-wide text-muted">
      {children}
    </p>
  );
}

export function Section({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section
      className="grid scroll-mt-24 items-start gap-4 border-b border-line py-10 last-of-type:border-b-0 md:grid-cols-[minmax(10rem,0.45fr)_minmax(0,1.55fr)] md:gap-12 md:py-16"
      id={id}
      aria-labelledby={`${id}-title`}
    >
      <h2
        className="m-0 font-serif text-2xl font-normal leading-tight tracking-[-0.04em] md:sticky md:top-12"
        id={`${id}-title`}
      >
        {title}
      </h2>

      <div className="min-w-0">{children}</div>
    </section>
  );
}

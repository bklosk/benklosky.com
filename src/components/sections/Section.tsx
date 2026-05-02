import type { ReactNode } from "react";

const sectionClass =
  "grid items-start scroll-mt-28 border-b border-line py-[clamp(1.5rem,4.5vw,3.25rem)] max-[900px]:gap-6 min-[901px]:grid-cols-[minmax(12rem,0.56fr)_minmax(0,1.44fr)] min-[901px]:gap-[clamp(2rem,7vw,7rem)] min-[901px]:min-h-[80vh] min-[901px]:grid-rows-[1fr]";
const sectionKickerClass =
  "z-[1] h-fit self-start max-[900px]:-mx-1 max-[900px]:px-1 max-[900px]:pb-3 max-[900px]:pt-2 min-[901px]:sticky min-[901px]:top-[clamp(1.25rem,4vw,3rem)] min-[901px]:min-h-48";
const sectionTitleClass =
  "m-0 max-w-32 font-serif text-[clamp(1.35rem,2.8vw,2rem)] font-normal leading-[0.95] tracking-[-0.045em] max-[900px]:max-w-none";

export const panelClass =
  "border border-line bg-panel shadow-[0_1.5rem_4rem_var(--shadow)]";
export const articleTitleClass =
  "my-2 font-serif text-[clamp(1.28rem,2.2vw,2rem)] font-normal leading-[1.1] tracking-[-0.035em]";
export const bodyTextClass = "leading-[1.55] text-muted";
export const cardPaddingClass = "p-[clamp(1.1rem,3vw,1.6rem)]";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[0.72rem] leading-[1.2] tracking-[0.03em] text-muted">
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
    <section className={sectionClass} id={id} aria-labelledby={`${id}-title`}>
      <div className={sectionKickerClass}>
        <p className={sectionTitleClass} id={`${id}-title`}>
          {title}
        </p>
      </div>

      <div className="min-w-0">{children}</div>
    </section>
  );
}

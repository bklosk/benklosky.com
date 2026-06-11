import Image from "next/image";
import { HoverCircleText } from "../HoverCircleText";
import { SocialLinks } from "../SocialLinks";
import { bodyTextClass, panelClass } from "./Section";

export function HeroSection() {
  return (
    <section
      className="grid items-center gap-10 border-b border-line py-10 md:min-h-[24rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16 md:py-16"
      id="about"
      aria-labelledby="intro-title"
    >
      <div>
        <h1
          className="mb-4 mt-0 font-serif text-5xl font-normal leading-[0.95] tracking-[-0.05em] md:text-6xl"
          id="intro-title"
          aria-label="Ben Klosky"
        >
          <HoverCircleText>Ben Klosky</HoverCircleText>
        </h1>
        <p className={`${bodyTextClass} max-w-prose text-base md:text-lg`}>
          I design and pilot interventions for Steve Levitt{" "}
          <span className="italic">(Freakonomics)</span>. I used to be in
          training to be a cop.
        </p>
        <div className="mt-6">
          <SocialLinks ariaLabel="Social links" />
        </div>
      </div>

      <div
        className={`${panelClass} relative aspect-[4/3] overflow-hidden rounded-xl`}
      >
        <Image
          alt="Portrait of Ben Klosky"
          className="object-cover contrast-[0.94] saturate-[0.82]"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          src="/portrait.jpeg"
        />
      </div>
    </section>
  );
}

import Image from "next/image";
import { bodyTextClass, panelClass } from "./Section";

const socials = [
  {
    label: "X",
    href: "https://x.com/benklosky",
  },
  {
    label: "GitHub",
    href: "https://github.com/bklosk",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ben-klosky",
  },
  {
    label: "Email",
    href: "mailto:benklosky@uchicago.edu",
  },
];

export function HeroSection() {
  return (
    <section
      className="flex min-h-[min(34rem,68vh)] scroll-mt-28 items-center border-b border-line pb-[clamp(1.5rem,4vh,2.5rem)] pt-[clamp(3rem,7vh,5rem)]"
      id="about"
      aria-labelledby="intro-title"
    >
      <div className="grid w-full items-center gap-[clamp(2rem,7vw,5.5rem)] min-[901px]:grid-cols-[minmax(17rem,0.92fr)_minmax(22rem,1.08fr)]">
        <div>
          <h1
            className="mb-4 mt-0 font-serif text-[clamp(2.1rem,3.8vw,3.35rem)] font-normal leading-[0.92] tracking-[-0.06em] max-[900px]:text-[clamp(2.7rem,13vw,5rem)]"
            id="intro-title"
          >
            Ben Klosky
          </h1>
          <p
            className={`${bodyTextClass} max-w-132 text-[clamp(0.95rem,1.3vw,1.1rem)]`}
          >
            I design and pilot interventions for Steve Levitt{" "}
            <span className="italic">{"(Freakonomics)"}</span>. I used to be in
            training to be a cop.
          </p>
          <nav
            className="mt-6 flex flex-wrap gap-x-4 gap-y-3"
            aria-label="Social links"
          >
            {socials.map((social) => {
              const isExternal = social.href.startsWith("http");

              return (
                <a
                  className="border-b border-line text-[0.86rem] text-foreground no-underline transition-colors duration-200 hover:border-accent hover:text-accent-strong"
                  href={social.href}
                  key={social.href}
                  rel={isExternal ? "noreferrer" : undefined}
                  target={isExternal ? "_blank" : undefined}
                >
                  {social.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div
          className={`${panelClass} relative aspect-[1.28] overflow-hidden rounded-xl`}
        >
          <Image
            alt="Portrait of Ben Klosky"
            className="object-cover saturate-[0.82] contrast-[0.94]"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src="/17F2D6A0-AD87-46DB-B5E6-FC90A031D221_1_105_c.jpeg"
          />
        </div>
      </div>
    </section>
  );
}

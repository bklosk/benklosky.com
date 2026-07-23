import {
  FileText,
  Github,
  Linkedin,
  Mail,
  NotebookPen,
  Twitter,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { BubbleCanvas } from "./bubble-canvas";

const linkIconProps = {
  size: 15,
  strokeWidth: 2,
  "aria-hidden": true as const,
};

type LinkItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

const links: LinkItem[] = [
  {
    label: "Email",
    href: "mailto:benklosky@uchicago.edu",
    icon: Mail,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ben-klosky",
    icon: Linkedin,
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/bklosk",
    icon: Github,
    external: true,
  },
  {
    label: "Twitter",
    href: "https://x.com/benklosky",
    icon: Twitter,
    external: true,
  },
  {
    label: "Blog",
    href: "#blog",
    icon: NotebookPen,
  },
  {
    label: "Resume",
    href: "/resume.pdf",
    icon: FileText,
  },
];

export default function Home() {
  return (
    <BubbleCanvas>
      <div className="composition">
        <div className="link-column">
          <Image
            className="portrait"
            src="/ben.jpg"
            alt="Ben Klosky"
            width={80}
            height={80}
            priority
          />
          <nav className="link-wall" aria-label="Links">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                >
                  <Icon {...linkIconProps} />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <aside id="about" className="intro">
          <p>
            I'm Ben Klosky, a{" "}
            <a href="https://en.wikipedia.org/wiki/Maker_culture">maker</a> and technologist. I
            design products for Steve Levitt's <a href="https://risc.uchicago.edu">lab</a> (of{" "}
            <span className="italic">Freakonomics</span> fame).
          </p>
          <p>
            Right now, I work on the{" "}
            <a href="https://fosterinsights.org">foster care system</a> and a{" "}
            <a href="https://thelevittlab.org">radical new school</a>.
          </p>
          <p>
            I&apos;ve worked as a machine learning engineer, a math teacher, in
            econ research, and as an apprentice at a police department.
          </p>
        </aside>
      </div>
    </BubbleCanvas>
  );
}

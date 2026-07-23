import type { ReactNode } from "react";

type LinkItem = {
  label: string;
  href: string;
  icon: ReactNode;
  external?: boolean;
};

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M3 5.75A1.75 1.75 0 0 1 4.75 4h14.5A1.75 1.75 0 0 1 21 5.75v12.5A1.75 1.75 0 0 1 19.25 20H4.75A1.75 1.75 0 0 1 3 18.25V5.75Zm1.75-.25a.25.25 0 0 0-.25.25v.38l7.1 4.62a.75.75 0 0 0 .8 0l7.1-4.62v-.38a.25.25 0 0 0-.25-.25H4.75Zm14.75 2.6-6.55 4.26a2.25 2.25 0 0 1-2.4 0L4.5 8.1v10.15c0 .14.11.25.25.25h14.5a.25.25 0 0 0 .25-.25V8.1Z"
      />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M5.37 7.54H1.85V22h3.52V7.54ZM3.61 1.5a2.06 2.06 0 1 0 0 4.12 2.06 2.06 0 0 0 0-4.12ZM22.15 13.71c0-4.36-2.33-6.39-5.44-6.39a4.69 4.69 0 0 0-4.25 2.34V7.54H8.94V22h3.52v-7.16c0-1.89.36-3.72 2.7-3.72 2.31 0 2.34 2.16 2.34 3.84V22h3.52l1.13-8.29Z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.24c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.58-.3-5.29-1.29-5.29-5.69 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.47.11-3.06 0 0 .98-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.11 3.06.75.81 1.2 1.84 1.2 3.1 0 4.42-2.72 5.39-5.31 5.68.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.73L8.44 4.05H6.58L17.8 19.84Z"
      />
    </svg>
  );
}

function WritingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M4 3.75A.75.75 0 0 1 4.75 3h9.5a.75.75 0 0 1 .75.75V8h3.25a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75V15H4.75a.75.75 0 0 1-.75-.75V3.75ZM9 15v4.5h8.5V9.5H15V14.25A.75.75 0 0 1 14.25 15H9Zm-3.5-1.5h8V4.5h-8v9Z"
      />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M6.75 3A1.75 1.75 0 0 0 5 4.75v14.5c0 .97.78 1.75 1.75 1.75h10.5A1.75 1.75 0 0 0 19 19.25V8.56c0-.46-.18-.9-.51-1.23l-3.82-3.82A1.75 1.75 0 0 0 13.44 3H6.75ZM6.5 4.75c0-.14.11-.25.25-.25h6.25v3.5c0 .41.34.75.75.75h3.5v10.5a.25.25 0 0 1-.25.25H6.75a.25.25 0 0 1-.25-.25V4.75ZM8.75 12a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"
      />
    </svg>
  );
}

const links: LinkItem[] = [
  {
    label: "Email",
    href: "mailto:benklosky@uchicago.edu",
    icon: <MailIcon />,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ben-klosky",
    icon: <LinkedinIcon />,
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/bklosk",
    icon: <GithubIcon />,
    external: true,
  },
  {
    label: "X",
    href: "https://x.com/benklosky",
    icon: <XIcon />,
    external: true,
  },
  {
    label: "Writing",
    href: "#writing",
    icon: <WritingIcon />,
  },
  {
    label: "Resume",
    href: "/resume.pdf",
    icon: <ResumeIcon />,
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <div className="composition">
        <nav className="link-wall" aria-label="Links">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </nav>

        <aside id="about" className="intro">
          <p>
            I’m Ben Klosky, a{" "}
            <a href="https://en.wikipedia.org/wiki/Maker_culture">maker</a>. I
            design products for a <a href="https://risc.uchicago.edu">lab</a>{" "}
            founded by Steve Levitt (of{" "}
            <span className="italic">Freakonomics</span> fame).
          </p>
          <p>
            Right now, I work on the <a href="fosterinsights.org">foster care system</a> and a <a href="thelevittlab.org">radical new school</a>.
          </p>
          <p>
            I&apos;ve worked as a machine learning engineer, a math teacher, in
            econ research, and as an apprentice at a police department.
          </p>
        </aside>
      </div>
    </main>
  );
}

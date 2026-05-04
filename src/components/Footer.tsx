const socials = [
  { label: "X", href: "https://x.com/benklosky" },
  { label: "GitHub", href: "https://github.com/bklosk" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ben-klosky" },
  { label: "Email", href: "mailto:benklosky@uchicago.edu" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="pb-[clamp(2rem,5vw,3rem)] pt-[clamp(1.05rem,3vw,1.75rem)]"
      aria-label="Site footer"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="m-0 text-[0.86rem] text-muted">
          © {year} Ben Klosky
        </p>
        <nav
          className="flex flex-wrap gap-x-4 gap-y-3"
          aria-label="Footer social links"
        >
          {socials.map((social) => {
            const isExternal = social.href.startsWith("http");

            return (
              <a
                className="border-b border-line text-[0.86rem] text-foreground no-underline transition-colors duration-200 hover:border-foreground hover:text-accent-strong"
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
    </footer>
  );
}

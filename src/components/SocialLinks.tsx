const socials = [
  { label: "X", href: "https://x.com/benklosky" },
  { label: "GitHub", href: "https://github.com/bklosk" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ben-klosky" },
  { label: "Email", href: "mailto:benklosky@uchicago.edu" },
];

export function SocialLinks({ ariaLabel }: { ariaLabel: string }) {
  return (
    <nav className="flex flex-wrap gap-x-5 gap-y-3" aria-label={ariaLabel}>
      {socials.map(({ label, href }) => {
        const isExternal = href.startsWith("http");

        return (
          <a
            className="border-b border-line pb-0.5 text-sm text-foreground no-underline transition-colors duration-200 hover:border-foreground hover:text-accent-strong"
            href={href}
            key={href}
            rel={isExternal ? "noreferrer" : undefined}
            target={isExternal ? "_blank" : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

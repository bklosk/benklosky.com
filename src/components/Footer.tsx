import { SocialLinks } from "./SocialLinks";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="py-10" aria-label="Site footer">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="m-0 text-sm text-muted">© {year} Ben Klosky</p>
        <SocialLinks ariaLabel="Footer social links" />
      </div>
    </footer>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Folder, Github, Linkedin, Mail, Twitter, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { BubbleCanvas } from "./bubble-canvas";

const linkIconProps = {
  size: 15,
  strokeWidth: 2,
  "aria-hidden": true as const,
};

const links: { label: string; href: string; icon: LucideIcon; external?: boolean }[] = [
  { label: "Email", href: "mailto:benklosky@uchicago.edu", icon: Mail },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/ben-klosky", icon: Linkedin, external: true },
  { label: "GitHub", href: "https://github.com/bklosk", icon: Github, external: true },
  { label: "Twitter", href: "https://x.com/benklosky", icon: Twitter, external: true },
  { label: "Projects", href: "/projects", icon: Folder },
];

const menuEase = [0.22, 1, 0.36, 1] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  const menuTransition = reduceMotion ? { duration: 0 } : { duration: 0.34, ease: menuEase };

  return (
    <BubbleCanvas enabled={pathname !== "/shelf"}>
      <div className={`composition${pathname === "/shelf" ? " composition--shelf" : ""}`}>
        <div className={`link-column${expanded ? " is-open" : ""}`}>
          <div className="portrait-slot">
            <Image className="portrait" src="/ben.jpg" alt="" width={80} height={80} priority />
            <Link href="/" aria-label="Home" className="portrait-link portrait-home" />
            <button
              type="button"
              className="portrait-link portrait-toggle"
              aria-expanded={expanded}
              aria-controls="site-links"
              aria-label={expanded ? "Hide links" : "Show links"}
              onClick={() => setExpanded((open) => !open)}
            />
          </div>
          <motion.div
            id="site-links"
            className="link-wall-clip"
            initial={false}
            animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
            transition={menuTransition}
          >
            <motion.nav
              className="link-wall"
              aria-label="Links"
              inert={mobile && !expanded ? true : undefined}
              initial={false}
              animate={{ y: expanded ? 0 : -10, opacity: expanded ? 1 : 0 }}
              transition={menuTransition}
            >
              {links.map((link) => {
                const Icon = link.icon;
                return link.external || link.href.startsWith("mailto:") ? (
                  <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>
                    <Icon {...linkIconProps} />
                    <span>{link.label}</span>
                  </a>
                ) : (
                  <Link key={link.label} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
                    <Icon {...linkIconProps} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </motion.nav>
          </motion.div>
        </div>
        <div className="page-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </BubbleCanvas>
  );
}

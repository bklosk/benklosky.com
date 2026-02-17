import { AboutContent, BioLink } from "@/types";
import headshot from "../../public/headshot.jpeg";

export const aboutContent: AboutContent = {
  image: headshot,
  blurb: `
  
  I'm a software engineer at the University of Chicago, where I work for Steve Levitt (of Freakonomics fame). My job here is to design and pilot solutions to massive social issues. I've built production ML systems for child welfare agencies, helped launch an experimental high school, and worked on a variety of other projects. 
  
  In another life, I was an apprentice at a police department, and I went to community college. I've worked as a machine learning engineer and did labor/workforce research at the Urban Institute. I have a masters degree in economics (yes, I took real analysis).
  `,
};

export const bioLinks: BioLink[] = [
  { label: "RESUME", href: "/resume.pdf", isExternal: true },
  { label: "ABOUT ME", view: "about" },
  {
    label: "LINKEDIN",
    href: "https://www.linkedin.com/in/ben-klosky/",
    isExternal: true,
  },
  { label: "X", href: "https://twitter.com/benklosky", isExternal: true },
  { label: "GITHUB", href: "https://github.com/bklosk", isExternal: true },
  { label: "EMAIL", href: "mailto:benklosky@uchicago.edu", isExternal: true },
];

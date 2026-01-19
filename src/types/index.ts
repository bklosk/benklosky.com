import { StaticImageData } from "next/image";

// View types for navigation
export type ViewType = "home" | "about" | "resume" | "project";

// Project data structure
export interface Project {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  year: string;
  image: string | StaticImageData;
  description: string;
  color: string;
}

// About content structure
export interface AboutContent {
  image: string | StaticImageData;
  blurb: string;
}

export interface BioLink {
  label: string;
  href?: string;
  view?: ViewType;
  isExternal?: boolean;
}

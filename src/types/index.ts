import { StaticImageData } from "next/image";

// View types for navigation
export type ViewType = "home" | "about" | "project" | "article";

// Article data structure
export interface Article {
  id: string;
  title: string;
  date: string;
  readTime: string;
  excerpt: string;
  content: string; // For now just a string, maybe markdown later
  tags: string[];
}


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

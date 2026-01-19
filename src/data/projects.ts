import { Project } from "@/types";
import fiProject from "../../public/projects/fi.png";
import riscWebsite from "../../public/projects/risc.png";
import metric_math from "../../public/projects/metric_math.png";
import carter from "../../public/projects/carter.png";
import thesis from "../../public/projects/thesis.png";
import framework from "../../public/projects/framework.png";
import ai from "../../public/projects/ai.png";
import vittcoin from "../../public/projects/vittcoin.png";

export const projects: Project[] = [
  {
    id: 1,
    title: "Foster Insights",
    subtitle: "Web Application",
    category: "Web app",
    year: "2024",
    image: fiProject,
    description: "Real data omitted due to sensitive nature. A web application to identify where children were placed suboptimally into foster care. Adopted by many agencies, used for very critical decisions, lead to a measurable decline in the number of children placed into adverse situations (like congregate care or placed very, very far away from their home).",
    color: "#ff6933",
  },
  {
    id: 2,
    title: "Metric Math",
    subtitle: "Web Application",
    category: "Web app",
    year: "2025",
    image: metric_math,
    description: `
    Real time error correction for handwritten math problems. Works like spellcheck for math. Using set-of-marks, a vision model estimates a bounding box around incorrect handwritten math on a tablet and offers feedback without giving the answer.`,
    color: "#8b95c9",
  },
  {
    id: 3,
    title: "carter",
    subtitle: "Web Application",
    category: "Web app",
    year: "2026",
    image: carter,
    description: `
     Cursor for maps. I'm running a ToolLoopAgent against custom tools to manipulate maplibre GL JS and protomaps to turn natural language prompts into functioning GIS applications.`,
    color: "#8b95c9",
  },
  {
    id: 4,
    title: "RISC Website",
    subtitle: "Web Application",
    category: "Website",
    year: "2024",
    image: riscWebsite,
    description: `
     Rebuilt the ancient website for my lab, the Center for Radical Innovation for Social Change at the University of Chicago. It's a nextjs app with a headless CMS and some real nice motion design + scrolljacking.`,
    color: "#8b95c9",
  },
  {
    id: 5,
    title: "Non-police response",
    subtitle: "Web Application",
    category: "Thesis",
    year: "2026",
    image: thesis,
    description: `
     My master's thesis: propensity score matching on Big Data to estimate the causal impact of the unarmed crisis response model on crime in Chicago.`,
    color: "#8b95c9",
  },
  {
    id: 6,
    title: "Apprenticeship Framework",
    subtitle: "Web Application",
    category: "Paper",
    year: "2023",
    image: framework,
    description: `
    Built a framework to design and onboard apprenticeships in the private sector. I also built a variety of job specific training programs for apprenticeships that didn't exist yet (e.g. apprenticing QA testing or wind turbine maintenance).
    `,
    color: "#8b95c9",
  },

  {
    id: 7,
    title: "AI",
    subtitle: "Talk",
    category: "Talk",
    year: "2025",
    image: ai,
    description: `
    I gave talks to child welfare leaders across the county about how to use "AI" (...natural language processing...) to help children and families. This was in partnership with the Center for Civic Futures.`,
    color: "#8b95c9",
  },
  {
    id: 8,
    title: "Vittcoin",
    subtitle: "iOS app",
    category: "iOS app",
    year: "2025",
    image: vittcoin,
    description: `
    A fake cryptocurrency iOS app, to incentivize students at a pilot high school to learn about finance and economics. I also built Vitmo, so that the students could send eachother vtc (vittcoin). A very silly, very fun project.
    `,
    color: "#8b95c9",
  }


];

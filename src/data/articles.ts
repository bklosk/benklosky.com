import { Article } from "@/types";

export const articles: Article[] = [
  {
    id: "1",
    title: "The Future of AI in Education",
    date: "Jan 15, 2026",
    readTime: "5 min read",
    excerpt: "Exploring how large language models are reshaping personalized learning and assessment.",
    content: `
      Artificial Intelligence is rapidly transforming the educational landscape. From personalized tutors to automated grading, the possibilities are endless.
      
      However, we must also consider the ethical implications. Data privacy, algorithmic bias, and the digital divide are critical issues that need to be addressed.
      
      In this article, we'll explore the potential benefits and risks of AI in education, and how we can ensure that these technologies are used to support all learners.
    `,
    tags: ["AI", "Education", "EdTech"]
  },
  {
    id: "2",
    title: "Building Resilient Systems",
    date: "Dec 10, 2025",
    readTime: "8 min read",
    excerpt: "Lessons learned from scaling distributed applications in high-stakes environments.",
    content: `
      Resilience is a key property of any large-scale system. It's not a matter of if failures will occur, but when.
      
      Designing for failure means assuming that components will break, networks will partition, and latencies will spike.
      
      We'll look at patterns like circuit breakers, bulkheads, and retry policies that can help your system survive and recover from these inevitable failures.
    `,
    tags: ["System Design", "Engineering", "DevOps"]
  },
  {
    id: "3",
    title: "The Economics of Open Source",
    date: "Nov 22, 2025",
    readTime: "6 min read",
    excerpt: "Analyzing the incentives and sustainability models behind successful open source projects.",
    content: `
      Open source software powers the modern internet. But how do these projects sustain themselves?
      
      We'll examine different business models, from donation-based funding to open-core and dual-licensing strategies.
      
      Understanding the economics of open source is crucial for maintainers, contributors, and companies that rely on these technologies.
    `,
    tags: ["Economics", "Open Source", "Business"]
  }
];

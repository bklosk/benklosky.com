import { Article } from "@/types";

export const articles: Article[] = [
  {
    id: "1",
    title: "The Economics of Open Source",
    date: "Jan 25, 2025",
    readTime: "1 min read",
    excerpt:
      "Analyzing the incentives and sustainability models behind successful open source projects.",
    content: `
      Why give your time to open source projects, ever? You're not paid for it. Your boss likely doesn't want the IP headache. Your code is going to be eaten by Anthropic. Maintainers probably reject most of your PRs.

      Think about a cheap talk model. There is no better technology to signal to potential employers that you're a good developer. It's really, really hard for managers to tell the difference between a good developer and a bad one, let alone evaluate codebase quality. FOSS maintainers treat their work with a borderline religious tone. Hacker News treats FOSS development like an act of mercy. It's not! But by keeping the bar high, reliable FOSS projects can signal to potential employers that you know what you're doing. It's a little bit altruistic, sure, but the self-transcendence is probably just motivated reasoning for a self-serving strategy.
    `,
    tags: ["Economics", "Open Source", "Business"],
  },
  {
    id: "2",
    title: "Instrumentality",
    date: "Jan 26, 2026",
    readTime: "5 min read",
    excerpt: "Crime and time horizons.",
    content: `
    The death penalty doesn't work. It costs a lot of money and doesn't deter crime. People kill each other, in states with and without it. Doesn't stop politicians from buying the death penalty at a steep price. 

    When I was working at a police department, I saw a lot of arrests. I saw a lot of crime, and more suffering than I would like to admit exists in the world. However, I don't think I saw a single crime that was seriously premeditated. 

    Crimes that require serious planning were rare, mostly drug-related, and overwhelmingly non-violent. Violence I saw happened when opportunity arrived at the wrong time, not because of planning.
    
    I was consistently shocked at how rarely strangers hurt each other. If you're murdered, it will be by your boyfriend, your family member, or your rival. Your murderer will be male, he will use a firearm (probably a handgun), it will likely happen at or near your home, and you will know him personally.
    
    A fight will get out of hand, and someone who happens to have a handgun will use it.`,
    tags: ["Crime", "Economics"],
  },
];

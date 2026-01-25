import { Article } from "@/types";

export const articles: Article[] = [
  {
    id: "1",
    title: "The Economics of Open Source",
    date: "Jan 25, 2025",
    readTime: "6 min read",
    excerpt:
      "Analyzing the incentives and sustainability models behind successful open source projects.",
    content: `
      Why give your time to open source projects, ever? You're not paid for it. Your boss likely doesn't want the IP headache. Your code is going to be eaten by Anthropic. Maintainers probably reject most of your PRs.

      It's the lowest cost way to signal to potential employers. Robin Hanson and George Hotz know this. FOSS devs probably think they're altruistic. They're not! Well, maybe a little bit, but the self-transcendence is probably just motivated reasoning for a self-serving strategy.
    `,
    tags: ["Economics", "Open Source", "Business"],
  },
];

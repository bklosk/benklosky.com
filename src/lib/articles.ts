import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Article } from '@/types';

const articlesDirectory = path.join(process.cwd(), 'src/content/articles');

export function getArticles(): Article[] {
  // Create directory if it doesn't exist (though we just created it)
  if (!fs.existsSync(articlesDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(articlesDirectory);
  const allArticlesData = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      // Read markdown file as string
      const fullPath = path.join(articlesDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      // Use gray-matter to parse the post metadata section
      const { data, content } = matter(fileContents);

      // Combine the data with the id and content
      return {
        id: data.id || fileName.replace(/\.md$/, ''),
        title: data.title,
        date: data.date,
        readTime: data.readTime,
        excerpt: data.excerpt,
        content: content,
        tags: data.tags || [],
      } as Article;
    });

  // Sort articles by date
  return allArticlesData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

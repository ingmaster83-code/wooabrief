import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['부동산', '보험']),
    kind: z.enum(['digest', 'news', 'guide']).default('digest'),
    tags: z.array(z.string()).default([]),
    sources: z.array(z.object({ title: z.string(), link: z.string(), publisher: z.string() })).default([]),
  }),
});

export const collections = { posts };

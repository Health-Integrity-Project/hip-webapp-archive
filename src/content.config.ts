import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One folder per post: src/content/blog/<slug>/index.md, with images
// co-located in the same folder and referenced relatively (e.g. ./cover.png).
const blog = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/blog',
    // Use the folder name as the slug (default would keep "/index").
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().default(''),
      date: z.coerce.date(),
      author: z.string().optional(),
      // Relative path to a co-located image; Astro optimizes it at build.
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };

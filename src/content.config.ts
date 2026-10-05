import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Help pages under /docs/<id>. `group` places a page in the sidebar,
// `order` sorts within the group.
const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    group: z.enum(["Start", "Run apps", "Operate", "Reference"]),
    order: z.number(),
  }),
});

export const collections = { docs };

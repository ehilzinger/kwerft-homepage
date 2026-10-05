import { getCollection, type CollectionEntry } from "astro:content";

export const GROUPS = ["Start", "Run apps", "Operate", "Reference"] as const;

/** All help pages, in sidebar order. */
export async function sortedDocs(): Promise<CollectionEntry<"docs">[]> {
  const all = await getCollection("docs");
  return all.sort((a, b) =>
    GROUPS.indexOf(a.data.group) - GROUPS.indexOf(b.data.group) || a.data.order - b.data.order);
}

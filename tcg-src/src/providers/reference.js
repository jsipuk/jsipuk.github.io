import { createCollection } from "../domain/collection.js";
export async function loadReference(fetcher = fetch) {
  const response = await fetcher("./data/reference.json");
  if (!response.ok)
    throw Error("Could not load the English reference. Reload to retry.");
  const reference = await response.json();
  createCollection(reference); // Validate before any card can enter ownership.
  return reference;
}

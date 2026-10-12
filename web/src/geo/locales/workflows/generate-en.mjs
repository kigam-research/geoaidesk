/** Regenerate upstream row text without changing prompts or handwritten UI messages. */
import { readFileSync, writeFileSync } from "node:fs";
const target = new URL("./en.json", import.meta.url);
const workflows = JSON.parse(readFileSync(new URL("../../../data/workflows.json", import.meta.url), "utf8"));
const catalogue = JSON.parse(readFileSync(target, "utf8"));
catalogue.rows = Object.fromEntries(workflows.map(({ id, name, description, placeholders }) => {
  if (id.includes(".") || placeholders.some(({ key }) => key.includes("."))) throw new Error(`Invalid flattened workflow key: ${id}`);
  return [id, { name, description, inputs: Object.fromEntries(placeholders.map(({ key, label }) => [key, label])) }];
}));
writeFileSync(target, JSON.stringify(catalogue, null, 2) + "\n");

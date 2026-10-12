/**
 * Saved recipes (gaid-workflow-catalog; contract web/src/geo/contracts/workspace.ts):
 * a `.geo-start.json` recipe that passed `checkRecipe` is filed by the user
 * under a workflow-panel category with a title. One project file,
 * `.kady/geo/recipes.json`; listing re-checks every recipe against the active
 * catalogue so a recipe from an older catalogue shows why it cannot open,
 * instead of disappearing. Nothing here starts a task.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectPaths } from "../../projects.ts";
import type {
  GeoRecipeCategory,
  GeoSavedRecipe,
  GeoSavedRecipesResponse,
  GeoStartRecipe,
} from "../../../../web/src/geo/contracts/workspace.ts";
import { GEO_RECIPE_CATEGORY } from "../../../../web/src/geo/contracts/workspace.ts";
import type { GeoCatalogue } from "../catalogue.ts";
import { geoStateDir } from "../context.ts";
import { checkRecipe } from "./recipes.ts";

interface StoredRecipe {
  id: string;
  title: string;
  category: string;
  recipe: GeoStartRecipe;
  savedAt: string;
}

interface Store {
  schemaVersion: "gaid-saved-recipes/v1";
  categories: GeoRecipeCategory[];
  recipes: StoredRecipe[];
}

/** Built-in ids: `geoscience` and upstream workflow categories (lowercase words). User ids are `user-<n>`. */
const CATEGORY_ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
const RECIPE_ID_RE = /^[a-f0-9-]{36}$/;
const MAX_TITLE = 120;
const MAX_LABEL = 40;
const MAX_RECIPES = 200;
const MAX_CATEGORIES = 50;

export class SavedRecipeError extends Error {
  constructor(readonly statusCode: number, message: string, readonly issues?: GeoSavedRecipe["check"]["issues"]) {
    super(message);
  }
}

function file(paths: ProjectPaths): string {
  return path.join(geoStateDir(paths), "recipes.json");
}

function read(paths: ProjectPaths): Store {
  let raw: string;
  try {
    raw = fs.readFileSync(file(paths), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: "gaid-saved-recipes/v1", categories: [], recipes: [] };
    throw err;
  }
  const value = JSON.parse(raw) as Partial<Store>;
  if (value?.schemaVersion !== "gaid-saved-recipes/v1" || !Array.isArray(value.categories) || !Array.isArray(value.recipes)) {
    // A malformed file is reported, never rewritten.
    throw new SavedRecipeError(409, `${file(paths)} is not a gaid-saved-recipes/v1 file`);
  }
  return value as Store;
}

function write(paths: ProjectPaths, store: Store): void {
  const target = file(paths);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, target);
}

function view(store: Store, catalogue: GeoCatalogue | null): GeoSavedRecipesResponse {
  return {
    categories: store.categories,
    recipes: store.recipes.map((row): GeoSavedRecipe => ({ ...row, check: checkRecipe(row.recipe, catalogue) })),
  };
}

export function listSavedRecipes(paths: ProjectPaths, catalogue: GeoCatalogue | null): GeoSavedRecipesResponse {
  return view(read(paths), catalogue);
}

const clean = (value: unknown, max: number, what: string): string => {
  if (typeof value !== "string") throw new SavedRecipeError(400, `${what} must be a string`);
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) throw new SavedRecipeError(400, `${what} is required`);
  if (text.length > max) throw new SavedRecipeError(400, `${what} is longer than ${max} characters`);
  return text;
};

export function saveRecipe(
  paths: ProjectPaths,
  catalogue: GeoCatalogue | null,
  body: { recipe?: unknown; title?: unknown; category?: unknown; newCategory?: unknown },
): GeoSavedRecipesResponse {
  const check = checkRecipe(body.recipe, catalogue);
  if (!check.ok) throw new SavedRecipeError(422, "The recipe did not pass the check", check.issues);
  const title = clean(body.title, MAX_TITLE, "title");
  const store = read(paths);
  if (store.recipes.length >= MAX_RECIPES) throw new SavedRecipeError(409, `At most ${MAX_RECIPES} recipes can be saved`);
  let category: string;
  if (body.newCategory !== undefined && body.newCategory !== null && body.newCategory !== "") {
    const label = clean(body.newCategory, MAX_LABEL, "newCategory");
    const existing = store.categories.find((row) => row.label.toLowerCase() === label.toLowerCase());
    if (existing) category = existing.id;
    else {
      if (store.categories.length >= MAX_CATEGORIES) throw new SavedRecipeError(409, `At most ${MAX_CATEGORIES} categories can be added`);
      let n = store.categories.length + 1;
      while (store.categories.some((row) => row.id === `user-${n}`)) n += 1;
      category = `user-${n}`;
      store.categories.push({ id: category, label });
    }
  } else {
    const id = typeof body.category === "string" && body.category ? body.category : GEO_RECIPE_CATEGORY;
    if (!CATEGORY_ID_RE.test(id)) throw new SavedRecipeError(400, `Invalid category "${id}"`);
    if (id.startsWith("user-") && !store.categories.some((row) => row.id === id)) {
      throw new SavedRecipeError(400, `Unknown category "${id}"`);
    }
    category = id;
  }
  store.recipes.push({ id: randomUUID(), title, category, recipe: body.recipe as GeoStartRecipe, savedAt: new Date().toISOString() });
  write(paths, store);
  return view(store, catalogue);
}

/** Removes the recipe; a user category left without recipes is removed with it. */
export function deleteSavedRecipe(paths: ProjectPaths, catalogue: GeoCatalogue | null, id: string): GeoSavedRecipesResponse {
  if (!RECIPE_ID_RE.test(id)) throw new SavedRecipeError(400, `Invalid recipe id "${id}"`);
  const store = read(paths);
  const row = store.recipes.find((candidate) => candidate.id === id);
  if (!row) throw new SavedRecipeError(404, `Recipe ${id} not found`);
  store.recipes = store.recipes.filter((candidate) => candidate.id !== id);
  store.categories = store.categories.filter((cat) => cat.id !== row.category || store.recipes.some((r) => r.category === cat.id));
  write(paths, store);
  return view(store, catalogue);
}

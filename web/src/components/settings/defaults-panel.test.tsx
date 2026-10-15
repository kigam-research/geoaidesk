const remoteComputeFeature = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/geo/features", () => ({ get REMOTE_COMPUTE_ENABLED() { return remoteComputeFeature.enabled; } }));
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as appSettings from "@/lib/app-settings";
import * as projectsLib from "@/lib/projects";
import * as modalJobs from "@/lib/use-modal-jobs";
import * as modelHooks from "@/lib/use-models";
import { DEFAULT_MODEL } from "@/components/model-selector";
import { DefaultsPanel } from "@/components/settings/defaults-panel";

const IMAGE_MODELS: appSettings.ImageModelListing = {
  builtIn: ["openrouter/openai/gpt-image-2.5-sunburst", "openrouter/google/gemini-3.1-flash-image"],
  models: [
    { ref: "openrouter/google/gemini-3.1-flash-image", name: "Google: Gemini 3.1 Flash Image", available: true, imageInput: true, cost: { input: 0.5, output: 3 } },
    { ref: "openrouter/openai/gpt-image-2.5-sunburst", name: "OpenAI: GPT Image 2.5 Sunburst", available: true, imageInput: true, cost: { input: 8, output: 8 } },
    { ref: "vertex/imagen", name: "Imagen", available: false, imageInput: false, cost: { input: 1, output: 2 } },
  ],
};

beforeEach(() => {
  appSettings.resetAppDefaultsCache();
  // Radix Select uses pointer capture, which jsdom lacks.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  vi.spyOn(appSettings, "getImageModels").mockResolvedValue(IMAGE_MODELS);
  vi.spyOn(projectsLib, "apiFetch").mockResolvedValue(new Response("{}", { status: 200 }));
  vi.spyOn(modalJobs, "useModalCatalog").mockReturnValue({
    catalog: null,
    loading: false,
    error: null,
    refresh: () => {},
  });
});
afterEach(() => vi.restoreAllMocks());

it("hides compute defaults and leaves an existing saved compute value untouched", async () => {
  remoteComputeFeature.enabled = false;
  try {
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({ compute: { target: "h100" } });
    const put = vi.spyOn(appSettings, "putAppDefaults").mockResolvedValue({});
    render(<DefaultsPanel />);
    const save = await screen.findByRole("button", { name: "Save defaults" });
    expect(screen.queryByText("Compute")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Type a model id for Default model" }));
    await user.type(screen.getByLabelText("Default model"), "openrouter/openai/gpt-5.5{Enter}");
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).not.toHaveProperty("compute");
  } finally { remoteComputeFeature.enabled = true; }
});

describe("DefaultsPanel", () => {
  it("shows the known custom default model's wire substitution without changing the saved level", async () => {
    const model = { ...DEFAULT_MODEL, id: "kigam-qwen/qwen", reasoning: true, thinkingSentAs: { high: "medium" } };
    vi.spyOn(modelHooks, "useModels").mockReturnValue({
      models: [model], ollamaModels: [], ollamaAvailable: false,
      openaiCompatibleModels: [], openaiCompatibleAvailable: false, openaiCompatibleConfigured: false,
      providerModels: [], providerStatuses: [], directProviderModels: [model], configuredDirectProviders: ["kigam-qwen"],
      modelAvailability: () => "available", isModelAvailable: () => true, hasAnyModelAccess: true, refresh: () => {},
    });
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({ model: model.id, thinkingLevel: "high" });
    const put = vi.spyOn(appSettings, "putAppDefaults");
    render(<DefaultsPanel />);
    expect(await screen.findByText("High → Medium")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save defaults" })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("saves a typed default model and leaves untouched keys cleared", async () => {
    const user = userEvent.setup();
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({});
    const put = vi.spyOn(appSettings, "putAppDefaults").mockImplementation(async (patch) => ({
      ...(patch.model ? { model: patch.model } : {}),
    }));
    render(<DefaultsPanel />);

    const save = await screen.findByRole("button", { name: "Save defaults" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Type a model id for Default model" }));
    await user.type(screen.getByLabelText("Default model"), "openrouter/openai/gpt-5.5{Enter}");
    await user.click(save);

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith({
        model: "openrouter/openai/gpt-5.5",
        thinkingLevel: null,
        compute: null,
        imageModel: null,
        verifierModel: null,
      }),
    );
    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
  });

  it("saves a default image model from the metered list and can clear it again", async () => {
    const user = userEvent.setup();
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({});
    const put = vi.spyOn(appSettings, "putAppDefaults").mockImplementation(async (patch) => ({
      ...(patch.imageModel ? { imageModel: patch.imageModel } : {}),
    }));
    render(<DefaultsPanel />);

    const trigger = await screen.findByRole("combobox", { name: "Default image model" });
    await waitFor(() => expect(trigger).toHaveTextContent("Not set — app default (OpenAI: GPT Image 2.5 Sunburst)"));
    await user.click(trigger);
    expect(screen.getByRole("option", { name: /Imagen/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /^Google: Gemini 3.1 Flash Image/ })).toHaveTextContent("$0.50 in · $3 out per M tokens");
    await user.click(screen.getByRole("option", { name: /^Google: Gemini 3.1 Flash Image/ }));
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(expect.objectContaining({ imageModel: "openrouter/google/gemini-3.1-flash-image" })),
    );
    expect(trigger).toHaveTextContent("Google: Gemini 3.1 Flash Image");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Not set/ }));
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() => expect(put).toHaveBeenLastCalledWith(expect.objectContaining({ imageModel: null })));
  });

  it("warns when the saved image model's provider is disconnected", async () => {
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({ imageModel: "vertex/imagen" });
    render(<DefaultsPanel />);
    expect(await screen.findByText(/provider is not connected/)).toBeInTheDocument();
  });

  it("saves a verifier model and lists the specialists it applies to", async () => {
    const user = userEvent.setup();
    vi.spyOn(appSettings, "getAppDefaults").mockResolvedValue({});
    vi.spyOn(appSettings, "getVerifierAgents").mockReturnValue(["statistical-reviewer", "comparative-reviewer"]);
    const put = vi.spyOn(appSettings, "putAppDefaults").mockImplementation(async (patch) => ({
      ...(patch.verifierModel ? { verifierModel: patch.verifierModel } : {}),
    }));
    render(<DefaultsPanel />);

    expect(await screen.findByText("statistical-reviewer, comparative-reviewer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Type a model id for Verifier model" }));
    await user.type(screen.getByLabelText("Verifier model"), "openrouter/anthropic/claude-opus-5.5{Enter}");
    await user.click(screen.getByRole("button", { name: "Save defaults" }));
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith(expect.objectContaining({ verifierModel: "openrouter/anthropic/claude-opus-5.5", model: null })),
    );
    expect(await screen.findByText(/image and verifier models apply right away/)).toBeInTheDocument();
  });

  it("shows the load error instead of an empty form", async () => {
    vi.spyOn(appSettings, "getAppDefaults").mockRejectedValue(new Error("Failed to load defaults (500)"));
    render(<DefaultsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load defaults (500)");
  });
});

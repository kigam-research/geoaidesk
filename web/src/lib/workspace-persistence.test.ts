import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
  deletePersistedChatState,
  flushServerProjectWorkspaceState,
  loadServerProjectWorkspaceState,
  loadWorkspaceSnapshot,
  parseWorkspaceMetadata,
  pruneDeletedProjectState,
  pruneWorkspaceMetadata,
  revokeSnapshotObjectUrls,
  saveProjectWorkspaceState,
  saveWorkspaceShellState,
  validateWorkspaceMetadata,
  type ProjectWorkspaceState,
} from "./workspace-persistence";

const projectState: ProjectWorkspaceState = {
  tabs: [
    {
      id: "tab-1",
      title: "Recovered chat",
      sessionId: "session-1",
      chat: {
        selectedModel: {
          id: "openrouter/test",
          label: "Test model",
          provider: "Test",
          tier: "mid",
          context_length: 128_000,
          pricing: { prompt: 1, completion: 2 },
          modality: "text",
          description: "Fixture",
        },
        thinkingLevel: "high",
        selectedComputeTarget: null,
        attachedFiles: ["notes.md"],
        selectedDatabases: [],
        selectedSkills: [
          { id: "literature", name: "Literature", description: "Search papers" },
        ],
        researchRefs: [
          {
            kind: "record",
            type: "decision",
            title: "Keep Emax",
            source: { kind: "notebook", sessionId: "session-0", entryId: "e1" },
            digest: "b".repeat(64),
          },
          { kind: "chat", sessionId: "session-0", title: "Earlier QC" },
        ],
        delegation: { specialists: [], auto: true, verify: true, verifiers: ["reviewer"] },
        queuedMessages: [],
        composer: { text: "unfinished question", attachments: [] },
      },
    },
  ],
  activeTabId: "tab-1",
  view: "chat",
  showNotebook: true,
  showCompute: false,
  showAutomation: false,
  computeScope: "session",
  sandboxOpen: false,
  chatOpen: true,
  treeWidth: 280,
  chatWidth: 600,
  sandbox: {
    openPaths: ["notes.md", "figure.png"],
    activePath: "figure.png",
  },
};

describe("workspace persistence schema", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips small workspace and per-chat state", async () => {
    await saveProjectWorkspaceState("project-a", projectState);
    await saveWorkspaceShellState("workspace", ["project-a"]);

    const restored = await loadWorkspaceSnapshot();

    expect(restored.version).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(restored.screen).toBe("workspace");
    expect(restored.openedProjectIds).toEqual(["project-a"]);
    expect(restored.projects["project-a"]).toMatchObject({
      activeTabId: "tab-1",
      showNotebook: true,
      showCompute: false,
      showAutomation: false,
      computeScope: "session",
      sandboxOpen: false,
      sandbox: {
        openPaths: ["notes.md", "figure.png"],
        activePath: "figure.png",
      },
      tabs: [
        {
          id: "tab-1",
          title: "Recovered chat",
          sessionId: "session-1",
          chat: {
            thinkingLevel: "high",
            attachedFiles: ["notes.md"],
            researchRefs: projectState.tabs[0].chat!.researchRefs,
            delegation: { specialists: [], auto: true, verify: true, verifiers: ["reviewer"] },
            composer: { text: "unfinished question", attachments: [] },
          },
        },
      ],
    });
  });

  it("falls back safely for invalid JSON and unsupported versions", () => {
    expect(parseWorkspaceMetadata("{not-json")).toMatchObject({
      version: WORKSPACE_SCHEMA_VERSION,
      screen: "projects",
      openedProjectIds: [],
      projects: {},
    });
    expect(validateWorkspaceMetadata({ version: 99, screen: "workspace" })).toMatchObject({
      screen: "projects",
      projects: {},
    });
    expect(
      validateWorkspaceMetadata({
        version: WORKSPACE_SCHEMA_VERSION,
        screen: "workspace",
        openedProjectIds: [],
        projects: {},
      }),
    ).toMatchObject({
      screen: "projects",
      openedProjectIds: [],
    });
  });

  it("retains the library inspector when restoring a project", () => {
    const restored = validateWorkspaceMetadata({ version: WORKSPACE_SCHEMA_VERSION, screen: "workspace",
      openedProjectIds: ["project-a"], projects: { "project-a": { ...projectState, view: "library" } } });
    expect(restored.projects["project-a"].view).toBe("library");
  });

  it("repairs corrupt tabs, selections, and panel sizes", () => {
    const repaired = validateWorkspaceMetadata({
      version: WORKSPACE_SCHEMA_VERSION,
      screen: "workspace",
      openedProjectIds: ["project-a", "missing"],
      projects: {
        "project-a": {
          tabs: [
            { id: "tab-1", title: "One", sessionId: "same" },
            { id: "tab-1", title: "Duplicate" },
            { id: "tab-2", title: "Two", sessionId: "same" },
            { nope: true },
          ],
          activeTabId: "deleted-tab",
          view: "invalid",
          showNotebook: false,
          showCompute: true,
          showAutomation: false,
          computeScope: "invalid",
          treeWidth: -100,
          chatWidth: 10000,
          sandbox: {
            openPaths: ["a.md", "a.md", 42],
            activePath: "deleted.md",
          },
        },
      },
    });

    expect(repaired.openedProjectIds).toEqual(["project-a"]);
    expect(repaired.projects["project-a"]).toMatchObject({
      activeTabId: "tab-1",
      view: "chat",
      showNotebook: false,
      showCompute: true,
      showAutomation: false,
      computeScope: "project",
      treeWidth: 150,
      chatWidth: 720,
      sandbox: { openPaths: ["a.md"], activePath: "a.md" },
      tabs: [
        { id: "tab-1", sessionId: "same" },
        { id: "tab-2" },
      ],
    });
  });

  it("sanitizes Compute state without breaking v1 snapshots that predate it", () => {
    const legacy = validateWorkspaceMetadata({
      version: WORKSPACE_SCHEMA_VERSION,
      screen: "workspace",
      openedProjectIds: ["project-a"],
      projects: {
        "project-a": {
          tabs: [{
            id: "tab-1",
            title: "Legacy",
            chat: {
              selectedModel: { id: "openrouter/test", label: "Test" },
              selectedComputeTarget: "h100",
            },
          }],
          activeTabId: "tab-1",
          showNotebook: false,
          sandbox: { openPaths: [], activePath: null },
        },
      },
    });
    expect(legacy.projects["project-a"]).toMatchObject({
      showCompute: false,
      showAutomation: false,
      computeScope: "project",
      tabs: [
        {
          chat: {
            selectedComputeTarget: { id: "h100", label: "h100" },
          },
        },
      ],
    });

    const conflicting = validateWorkspaceMetadata({
      version: WORKSPACE_SCHEMA_VERSION,
      screen: "workspace",
      openedProjectIds: ["project-a"],
      projects: {
        "project-a": {
          tabs: [{ id: "tab-1", title: "Conflict" }],
          activeTabId: "tab-1",
          showNotebook: true,
          showCompute: true,
          showAutomation: false,
          computeScope: "session",
          sandbox: { openPaths: [], activePath: null },
        },
      },
    });
    expect(conflicting.projects["project-a"]).toMatchObject({
      showNotebook: true,
      showCompute: false,
      showAutomation: false,
      computeScope: "session",
    });
  });

  it("prunes deleted projects from metadata and storage", async () => {
    await saveProjectWorkspaceState("project-a", projectState);
    await saveProjectWorkspaceState("project-b", {
      ...projectState,
      tabs: [{ id: "tab-b", title: "B" }],
      activeTabId: "tab-b",
    });
    await saveWorkspaceShellState("workspace", ["project-a", "project-b"]);

    const metadata = parseWorkspaceMetadata(
      window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
    );
    expect(pruneWorkspaceMetadata(metadata, ["project-b"]).openedProjectIds).toEqual([
      "project-b",
    ]);

    await pruneDeletedProjectState(["project-b"]);
    const restored = await loadWorkspaceSnapshot();
    expect(Object.keys(restored.projects)).toEqual(["project-b"]);
    expect(restored.openedProjectIds).toEqual(["project-b"]);
  });

  it("refuses to prune against an empty project list", async () => {
    // A failed GET /projects leaves the caller with []; that must never be
    // read as "every project was deleted".
    await saveProjectWorkspaceState("project-a", projectState);
    await saveWorkspaceShellState("workspace", ["project-a"]);

    await pruneDeletedProjectState([]);
    const restored = await loadWorkspaceSnapshot();
    expect(Object.keys(restored.projects)).toEqual(["project-a"]);
    expect(restored.openedProjectIds).toEqual(["project-a"]);
  });

  it("removes closed tabs from durable metadata immediately", async () => {
    await saveProjectWorkspaceState("project-a", {
      ...projectState,
      tabs: [
        ...projectState.tabs,
        { id: "tab-2", title: "Second chat", sessionId: "session-2" },
      ],
    });

    await deletePersistedChatState("project-a", "tab-2");

    const metadata = parseWorkspaceMetadata(
      window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
    );
    expect(metadata.projects["project-a"].tabs.map((tab) => tab.id)).toEqual([
      "tab-1",
    ]);
  });

  it("never places draft image payloads in localStorage", async () => {
    await saveProjectWorkspaceState("project-a", {
      ...projectState,
      tabs: [
        {
          ...projectState.tabs[0],
          chat: {
            ...projectState.tabs[0].chat!,
            composer: {
              text: "image draft",
              attachments: [
                {
                  id: "image-1",
                  filename: "pixel.png",
                  mediaType: "image/png",
                  url: "data:image/png;base64,c2VjcmV0LWltYWdlLWJ5dGVz",
                },
              ],
            },
          },
        },
      ],
    });

    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toContain(
      "c2VjcmV0LWltYWdlLWJ5dGVz",
    );
  });

  it("revokes the blob URLs of a snapshot the caller discards", () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revoke,
      configurable: true,
      writable: true,
    });
    try {
      revokeSnapshotObjectUrls({
        version: WORKSPACE_SCHEMA_VERSION,
        screen: "workspace",
        openedProjectIds: ["project-a"],
        projects: {
          "project-a": {
            ...projectState,
            tabs: [
              {
                ...projectState.tabs[0],
                chat: {
                  ...projectState.tabs[0].chat!,
                  composer: {
                    text: "restored",
                    attachments: [
                      { id: "image-1", filename: "a.png", mediaType: "image/png", url: "blob:a" },
                      // Data URLs are inline, not handles — nothing to release.
                      { id: "image-2", filename: "b.png", mediaType: "image/png", url: "data:b" },
                    ],
                  },
                },
              },
            ],
          },
        },
      });
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:a");
    } finally {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});

describe("workspace state on the GAID server (gaid-project-resume)", () => {
  type Call = { url: string; method: string; projectId: string | null; body: unknown; keepalive: boolean };
  let calls: Call[];

  function stubServer(records: Record<string, unknown>, answerFor?: (projectId: string) => string) {
    calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      const projectId = headers.get("X-Project-Id");
      const method = init.method ?? "GET";
      calls.push({
        url,
        method,
        projectId,
        body: typeof init.body === "string" ? JSON.parse(init.body) : null,
        keepalive: init.keepalive === true,
      });
      if (method === "GET") {
        const answered = answerFor ? answerFor(projectId!) : projectId!;
        return new Response(JSON.stringify({ projectId: answered, record: records[answered] ?? null }), { status: 200 });
      }
      return new Response(JSON.stringify({ projectId, revision: 1, savedAt: "2026-10-23T00:00:00Z" }), { status: 200 });
    }));
  }

  const record = (state: unknown) => ({
    schemaVersion: "gaid-workspace-state/v1",
    revision: 3,
    savedAt: "2026-10-23T00:00:00Z",
    clientId: "other-pc",
    state,
  });
  const puts = () => calls.filter((call) => call.method === "PUT");
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("restores a state saved on another PC and does not write it back unchanged", async () => {
    stubServer({ "srv-a": record(projectState) });
    const restored = await loadServerProjectWorkspaceState("srv-a");
    expect(calls[0]).toMatchObject({ method: "GET", projectId: "srv-a" });
    expect(calls[0].url).toContain("/geo/workspace-state");
    expect(restored).toMatchObject({
      activeTabId: "tab-1",
      sandbox: { openPaths: ["notes.md", "figure.png"], activePath: "figure.png" },
      tabs: [{ id: "tab-1", title: "Recovered chat", sessionId: "session-1" }],
    });

    // Mounting saves the same state: nothing is sent, so a browser that only
    // has the project open never overwrites a newer save from elsewhere.
    await saveProjectWorkspaceState("srv-a", restored!);
    await settle();
    flushServerProjectWorkspaceState("srv-a", restored!);
    expect(puts()).toHaveLength(0);

    // A real change is sent once, with this browser's id.
    await saveProjectWorkspaceState("srv-a", { ...restored!, chatWidth: 500 });
    await settle();
    expect(puts()).toHaveLength(1);
    expect(puts()[0]).toMatchObject({ projectId: "srv-a" });
    const body = puts()[0].body as { clientId: string; state: { chatWidth: number } };
    expect(body.state.chatWidth).toBe(500);
    expect(body.clientId).toMatch(/^[A-Za-z0-9-]{1,64}$/);
  });

  it("uploads the browser copy when the server has no record yet", async () => {
    stubServer({});
    expect(await loadServerProjectWorkspaceState("srv-b")).toBeNull();
    await saveProjectWorkspaceState("srv-b", projectState);
    await settle();
    expect(puts()).toHaveLength(1);
    expect((puts()[0].body as { state: { activeTabId: string } }).state.activeTabId).toBe("tab-1");
  });

  it("flushes an unsent change on page hide with a keepalive request", async () => {
    stubServer({ "srv-c": record(projectState) });
    const restored = await loadServerProjectWorkspaceState("srv-c");
    flushServerProjectWorkspaceState("srv-c", { ...restored!, treeWidth: 200 });
    await settle();
    expect(puts()).toHaveLength(1);
    expect(puts()[0].keepalive).toBe(true);
    // The save queued in the same page hide does not send it again.
    await saveProjectWorkspaceState("srv-c", { ...restored!, treeWidth: 200 });
    await settle();
    expect(puts()).toHaveLength(1);
  });

  it("ignores a reply for another project and never writes to it", async () => {
    stubServer({ default: record(projectState) }, () => "default");
    expect(await loadServerProjectWorkspaceState("srv-gone")).toBeNull();
    await saveProjectWorkspaceState("srv-gone", projectState);
    await settle();
    expect(puts()).toHaveLength(0);
  });

  it("drops a queued message whose images are not in this browser", async () => {
    const queued = {
      ...projectState,
      tabs: [{
        ...projectState.tabs[0],
        chat: {
          ...projectState.tabs[0].chat!,
          queuedMessages: [
            {
              id: "1", rawText: "with image", text: "with image",
              model: { id: "openrouter/test", label: "Test model" },
              databases: [], skills: [], files: [],
              images: [{ key: "srv-d:tab-1:queue:1:0", mediaType: "image/png" }],
              computeTarget: null, thinkingLevel: null, timestamp: 1,
            },
            {
              id: "2", rawText: "text only", text: "text only",
              model: { id: "openrouter/test", label: "Test model" },
              databases: [], skills: [], files: [], images: [],
              computeTarget: null, thinkingLevel: null, timestamp: 2,
            },
          ],
        },
      }],
    };
    stubServer({ "srv-d": record(queued) });
    const restored = await loadServerProjectWorkspaceState("srv-d");
    expect(restored!.tabs[0].chat!.queuedMessages.map((message) => message.id)).toEqual(["2"]);
  });
});

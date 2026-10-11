import { DEFAULT_MODEL } from "@/components/model-selector";
import { DEFAULT_THINKING_LEVEL } from "@/components/thinking-selector";
import { EMPTY_DELEGATION } from "@/lib/composer-context";
import { seedChatStateFromTab } from "@/lib/new-tab-state";
import type { ChatWorkspaceState } from "@/lib/workspace-persistence";
import type { GeoStartTaskDetail } from "@/geo/contracts/workspace";

/**
 * Chat state for a tab opened by a started task: the source tab's model,
 * thinking level and compute target (as for any new tab), plus the task's
 * draft, attached files, pinned skills and session exposure. The source tab
 * keeps its own draft.
 */
export function geoTaskChatState(source: ChatWorkspaceState | undefined, task: GeoStartTaskDetail): ChatWorkspaceState {
  const seeded = seedChatStateFromTab(source) ?? {
    selectedModel: DEFAULT_MODEL,
    thinkingLevel: DEFAULT_THINKING_LEVEL,
    selectedComputeTarget: null,
    attachedFiles: [],
    selectedDatabases: [],
    selectedSkills: [],
    researchRefs: [],
    delegation: EMPTY_DELEGATION,
    queuedMessages: [],
    composer: { text: "", attachments: [] },
  };
  return {
    ...seeded,
    attachedFiles: [...new Set(task.attachedFiles)],
    selectedSkills: task.skills,
    composer: { text: task.text, attachments: [] },
    geoExposure: task.geoExposure,
  };
}

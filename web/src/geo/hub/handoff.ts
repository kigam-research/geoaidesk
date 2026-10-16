/**
 * Hub → workspace hand-off: after installing a draft into a project, the hub opens that
 * project and asks its Workflow panel to open the method's start settings. The request is
 * kept until a workspace for that project takes it (the workspace mounts after the switch).
 */
export const OPEN_METHOD_SETUP_EVENT = "gaid:open-method-setup";

export interface OpenMethodSetupRequest {
  projectId: string;
  methodKey: string;
  workflowId: string | null;
  recipeId: string | null;
}

let pending: OpenMethodSetupRequest | null = null;

export function openMethodSetup(request: OpenMethodSetupRequest): void {
  pending = request;
  window.dispatchEvent(new CustomEvent(OPEN_METHOD_SETUP_EVENT));
}

export function hasMethodSetup(projectId: string): boolean {
  return pending?.projectId === projectId;
}

/** The workspace of `projectId` takes a pending request (once). */
export function takeMethodSetup(projectId: string): OpenMethodSetupRequest | null {
  if (!pending || pending.projectId !== projectId) return null;
  const request = pending;
  pending = null;
  return request;
}

export function onMethodSetupRequest(handler: () => void): () => void {
  window.addEventListener(OPEN_METHOD_SETUP_EVENT, handler);
  return () => window.removeEventListener(OPEN_METHOD_SETUP_EVENT, handler);
}

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import type { NoteBundlePreview, PublicExportPreview } from "@/geo/contracts/note-export";
import { formatSize, NoteBundleDialog, PublicExportDialog } from "./note-export";

vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));

const id = "2026-10-24-분석";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const zipBytes = new Uint8Array([80, 75, 5, 6]);
let zipSha = "";
const bundle = (): NoteBundlePreview => ({
  noteId: id, title: "분석 결과", digest: "d".repeat(64), totalBytes: 2048,
  files: [
    { name: "note/index.md", part: "note", bytes: 1024, sha256: "a".repeat(64) },
    { name: "note/figures/지도.png", part: "note", bytes: 512, sha256: "b".repeat(64) },
    { name: "data-fingerprints.json", part: "data", bytes: 512, sha256: "c".repeat(64) },
  ],
  data: [{ path: "user_data/wells.csv", sha256: "e".repeat(64), bytes: 8, usedAt: "2026-10-24T00:00:00Z", use: "read", now: "changed" }],
  environments: 1, workflow: { title: "중력 이상 분석", methodId: "m", workflowId: "w", version: "0.1.2", instructions: true },
  references: [{ key: "kim2024", reference: "Kim (2024)" }], gaps: ["unresolved-citations"],
});
const exportPreview = (): PublicExportPreview => ({
  noteId: id, digest: "f".repeat(64),
  candidates: [
    { id: "note", kind: "note", name: `${id}.md`, title: "분석 결과", bytes: 900, sha256: "1".repeat(64), licence: null },
    { id: "paper:li-1", kind: "paper", name: "kim2024.pdf", title: "Kim (2024). Gravity survey.", bytes: 3_000_000, sha256: "2".repeat(64), licence: null, key: "kim2024" },
  ],
  skipped: [{ key: "lee2020", title: "Lee (2020)", reason: "no-pdf" }],
});

beforeEach(async () => {
  localStorage.setItem("gaid:locale", "ko");
  const digest = await crypto.subtle.digest("SHA-256", zipBytes);
  zipSha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
  globalThis.URL.revokeObjectURL = vi.fn();
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path, init) => {
    if (path.includes("/bundle?") || path.includes("/public-export?")) return json(path.includes("/bundle?") ? bundle() : exportPreview());
    if (init?.method === "POST") return new Response(zipBytes, { status: 200, headers: { "X-Content-SHA256": zipSha, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${id}-bundle.zip`)}` } });
    throw new Error(`Unexpected: ${path}`);
  });
});

it("formats sizes with units", () => {
  expect(formatSize(512, "ko")).toBe("512 B");
  expect(formatSize(1536, "en")).toBe("1.5 KB");
  expect(formatSize(3_000_000, "en")).toBe("2.9 MB");
});

it("previews the result bundle and downloads it after checking the fingerprint", async () => {
  render(<NoteBundleDialog projectId="p1" noteId={id} open onOpenChange={vi.fn()} />);
  expect(await screen.findByText("파일 3개, 모두 2.0 KB")).toBeInTheDocument();
  expect(screen.getByText("노트 본문과 그림")).toBeInTheDocument();
  expect(screen.getByText("user_data/wells.csv")).toBeInTheDocument();
  expect(screen.getByText("기록 뒤 바뀜")).toBeInTheDocument();
  expect(screen.getByText("중력 이상 분석 · version 0.1.2")).toBeInTheDocument();
  expect(screen.getByText("일부 인용 키가 서재에 없습니다.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "묶음 내려받기" }));
  expect(await screen.findByText(/내려받았습니다/)).toBeInTheDocument();
  const post = vi.mocked(apiFetch).mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(post[0]).toBe(`/geo/notes/${encodeURIComponent(id)}/bundle`);
  expect(JSON.parse(String(post[1]!.body))).toEqual({ digest: "d".repeat(64), locale: "ko" });
});

it("refuses to save a bundle whose bytes differ from the server's fingerprint", async () => {
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (init?.method === "POST") return new Response(zipBytes, { status: 200, headers: { "X-Content-SHA256": "0".repeat(64) } });
    return json(bundle());
  });
  render(<NoteBundleDialog projectId="p1" noteId={id} open onOpenChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "묶음 내려받기" }));
  expect(await screen.findByText("받은 파일이 서버 기록과 다릅니다. 다시 내려받으세요.")).toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("asks for each file's confirmation before the public export and sends only confirmed files", async () => {
  render(<PublicExportDialog projectId="p1" noteId={id} open onOpenChange={vi.fn()} />);
  const boxes = await screen.findAllByRole("checkbox", { name: "기관 밖으로 내보내도 되는 자료입니다" });
  expect(boxes).toHaveLength(2);
  for (const box of boxes) expect(box).not.toBeChecked();
  expect(screen.getByText(/이용 조건 확인 안 됨/)).toBeInTheDocument();
  const action = screen.getByRole("button", { name: "고른 파일 내려받기" });
  expect(action).toBeDisabled();
  fireEvent.click(boxes[1]);
  expect(screen.getByText("파일 1개, 2.9 MB")).toBeInTheDocument();
  fireEvent.click(action);
  await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const post = vi.mocked(apiFetch).mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(String(post[1]!.body))).toEqual({ digest: "f".repeat(64), locale: "ko", files: [{ id: "paper:li-1", mayLeave: true }] });
  expect(await screen.findByText(/Gemini Notebook에서 소스로 추가하세요/)).toBeInTheDocument();
});

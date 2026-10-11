import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalModelCard, type LocalModelStatus } from "./card";

const initial: LocalModelStatus = {
  baseUrl: "http://localhost:11434", reachable: true, error: null,
  models: [{ model: "qwen3:trial", configuredContext: 32768, trainedContext: 131072, loadedContext: null }],
  provider: null, defaults: {}, verification: { state: "unverified" },
  profiles: [
    { id: "recorded-96k", contextWindow: 98304, evidence: "recorded-trial" },
    { id: "proposed-64k", contextWindow: 65536, evidence: "proposed-not-tested" },
  ],
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => vi.spyOn(navigator, "languages", "get").mockReturnValue(["ko-KR"]));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("LocalModelCard", () => {
  it("shows evidence limits, saves a selected preset and persists the returned model/default", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(initial)).mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse(init.body);
      return response({ ...initial, provider: { models: [{ id: body.model, contextWindow: body.contextWindow, maxTokens: body.maxTokens }] },
        defaults: { model: `gaid-local/${body.model}` }, verification: { state: "mismatch" } });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<LocalModelCard />);
    expect(await screen.findByText("Ollama 연결됨")).toBeInTheDocument();
    expect(screen.getByText(/CPU 오프로딩 약 18%/)).toBeInTheDocument();
    expect(screen.getByLabelText("이 컨텍스트로 파생 모델 생성")).not.toBeChecked();
    expect(screen.getByLabelText("컨텍스트 프로필")).toHaveValue("proposed-64k");
    expect(screen.getByLabelText("컨텍스트 토큰 수")).toHaveValue(65536);
    expect(screen.queryByRole("option", { name: /32K/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("기본 모델로 사용"));
    await userEvent.click(screen.getByRole("button", { name: "모델 설정 저장" }));
    expect(await screen.findByText("모델 설정을 저장했습니다.")).toBeInTheDocument();
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ model: "qwen3:trial", contextWindow: 65536, maxTokens: 4096, createVariant: false, setDefault: true });
    expect(fetcher.mock.calls[1][0]).toMatch(/\/geo\/local-model\/configure$/);
    expect(screen.getByText(/저장한 모델: gaid-local\/qwen3:trial · 컨텍스트 65536/)).toBeInTheDocument();
    expect(screen.getByText(/앱의 선언값과 Ollama 설정이 맞지 않습니다/)).toBeInTheDocument();
  });
  it("sends variant creation only after explicit selection and restores saved limits on mount", async () => {
    const persisted = { ...initial, provider: { models: [{ id: "qwen3:trial", contextWindow: 98304, maxTokens: 8192 }] },
      defaults: { model: "gaid-local/qwen3:trial" } };
    const fetcher = vi.fn().mockResolvedValueOnce(response(persisted)).mockResolvedValueOnce(response(persisted));
    vi.stubGlobal("fetch", fetcher);
    render(<LocalModelCard />);
    await screen.findByText("Ollama 연결됨");
    expect(screen.getByLabelText("컨텍스트 토큰 수")).toHaveValue(98304);
    expect(screen.getByLabelText("최대 출력 토큰 수")).toHaveValue(8192);
    expect(screen.getByLabelText("기본 모델로 사용")).toBeChecked();
    await userEvent.click(screen.getByLabelText("이 컨텍스트로 파생 모델 생성"));
    fireEvent.change(screen.getByLabelText("컨텍스트 토큰 수"), { target: { value: "80000" } });
    await userEvent.click(screen.getByRole("button", { name: "모델 설정 저장" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ contextWindow: 80000, createVariant: true });
    await waitFor(() => expect(screen.getByLabelText("이 컨텍스트로 파생 모델 생성")).not.toBeChecked());
  });
  it("shows unreachable status and disables saving; refresh recovers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...initial, reachable: false, error: "Ollama: unavailable", models: [] }))
      .mockResolvedValueOnce(response(initial));
    vi.stubGlobal("fetch", fetcher);
    render(<LocalModelCard />);
    expect(await screen.findByText("Ollama에 연결할 수 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모델 설정 저장" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "상태 새로고침" }));
    await screen.findByText("Ollama 연결됨");
    expect(screen.getByRole("button", { name: "모델 설정 저장" })).toBeEnabled();
  });
  it("reports save errors and reads back partially saved configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response({ detail: "Model saved, default unchanged" }, 409))
      .mockResolvedValueOnce(response({ ...initial, provider: { models: [{ id: "qwen3:trial", contextWindow: 32768, maxTokens: 4096 }] } })));
    render(<LocalModelCard />);
    await screen.findByText("Ollama 연결됨");
    await userEvent.click(screen.getByRole("button", { name: "모델 설정 저장" }));
    expect(await screen.findByText("Model saved, default unchanged")).toBeInTheDocument();
    expect(await screen.findByText(/저장한 모델: gaid-local/)).toBeInTheDocument();
    expect(screen.queryByText("모델 설정을 저장했습니다.")).not.toBeInTheDocument();
  });
});

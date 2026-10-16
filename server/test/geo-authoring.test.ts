/**
 * GAID hub authoring service (server/src/geo/authoring/), ported from skill_hub web/server/authoring.test.ts
 * (54fe477) to vitest. No real model is called: each test passes a scripted transport.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthoringError, AuthoringStore } from "../src/geo/authoring/store.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { quoteFound, readablePage } from "../src/geo/authoring/anchors.ts";
import { answerAll, answerQuestion, editDraft } from "../src/geo/authoring/routes.ts";
import { toContext, type ChatFn } from "../src/geo/authoring/model.ts";
import { analysis, cleanup, config, draftReply, fixture, PAPER, reply, testVocabulary, work } from "./helpers/geo-authoring.ts";

afterEach(cleanup);

const deps = (chat: ChatFn) => ({ chat, config, vocabulary: testVocabulary() });

describe("GAID hub authoring", () => {
  it("matches anchor quotes across layout spacing and rejects absent ones", () => {
    expect(quoteFound("spatial  blocks of\n50 km", "We use spatial blocks of 50 km for evaluation.")).toBe(true);
    expect(quoteFound("cross- validation", "nested cross-\nvalidation separates")).toBe(true);
    expect(quoteFound("random forest with 500 trees", PAPER.join("\n"))).toBe(false);
  });

  it("removes manuscript line numbers before quoting", () => {
    const page = [
      "17    probability",
      "18    surfaces to exploration priorities. This study develops a framework that com-",
      "19    bines positive-unlabeled learning",
    ].join("\n");
    const quote = "This study develops a framework that combines positive-unlabeled learning";
    expect(quoteFound(quote, page)).toBe(false);
    expect(quoteFound(quote, readablePage(page))).toBe(true);
    expect(readablePage("Plain text\nwithout numbers")).toBe("Plain text\nwithout numbers");
  });

  it("records PDF pages; analysis keeps verified findings, shapes questions and survives a restart", async () => {
    const { dir, store, projectId, source, extraction } = await fixture();
    expect(source.kind).toBe("pdf");
    expect(source.title).toBeUndefined();
    expect(extraction.pages).toBe(1);
    expect(extraction.coveredPages).toEqual([1]);
    const attempt = await runOperation(store, projectId, "analyze", "op-analyze-1", deps(reply(analysis)));
    expect(attempt.outcome).toBe("accepted");
    expect(attempt.model).toBe("test/fake");
    expect(attempt.usage).toMatchObject({ input: 10, output: 5 });
    let p = await store.read(projectId);
    expect(p.findings).toHaveLength(3);
    expect(p.findings.every((f) => f.anchors.every((a) => a.verified && a.page === 1))).toBe(true);
    expect(attempt.validationErrors[0].join("\n")).toMatch(/pages 1-1, not 7/);
    // One-question cards: hints kept, an "other" option dropped (the screen adds 기타), recommendation by id or label.
    const [scope, code] = p.questions;
    expect(scope.options.map((o) => o.id)).toEqual(["reproduction", "generalization"]);
    expect(scope.options[0].hint).toBe("논문 설정을 그대로 씁니다.");
    expect(scope.recommendedOptionId).toBe("generalization");
    expect(scope.recommendedWhy).toBe("목표가 다른 지역 적용입니다.");
    expect(code.answerType).toBe("choice-or-text");
    expect(code.recommendedOptionId).toBe("include");
    const again = await runOperation(store, projectId, "analyze", "op-analyze-1", deps(reply(analysis)));
    expect(again.id).toBe(attempt.id);
    const restarted = new AuthoringStore(dir);
    await restarted.initialize();
    p = await restarted.read(projectId);
    expect(p.questions.map((q) => q.status)).toEqual(["open", "open"]);
    expect(p.decisions).toHaveLength(0);
    const raw = JSON.parse(await readFile(join(dir, "projects", projectId, p.attempts[0].record!), "utf8"));
    expect(raw.responses).toHaveLength(1);
    expect(JSON.stringify(raw)).not.toContain('"reasoning"');
  });

  it("gives malformed output one repair; a second failure keeps the accepted state", async () => {
    const { store, projectId } = await fixture();
    const repaired = await runOperation(store, projectId, "analyze", "op-repair-1", deps(reply("not json", analysis)));
    expect(repaired.outcome).toBe("repaired");
    const before = await store.read(projectId);
    const rejected = await runOperation(store, projectId, "analyze", "op-repair-2", deps(reply('{"findings": "x"}', "{broken")));
    expect(rejected.outcome).toBe("rejected");
    const after = await store.read(projectId);
    expect(after.findings).toEqual(before.findings);
    expect(after.questions).toEqual(before.questions);
  });

  it("folds a repair turn into one provider-neutral user message", () => {
    const context = toContext([
      { role: "system", content: "S" },
      { role: "user", content: "request" },
      { role: "assistant", content: "bad reply" },
      { role: "user", content: "fix it" },
    ]);
    expect(context.systemPrompt).toBe("S");
    expect(context.messages).toHaveLength(1);
    const text = String(context.messages[0].content);
    expect(text).toContain("request");
    expect(text).toContain("## Your previous reply\nbad reply");
    expect(text).toContain("## Correction request\nfix it");
  });

  it("marks running attempts interrupted after a restart", async () => {
    const { dir, store, projectId } = await fixture();
    await store.mutate(projectId, (p) => {
      p.attempts.push({
        id: "att-running",
        op: "analyze",
        opId: "op-running",
        model: "test/fake",
        promptVersion: "x",
        sourceRevision: 1,
        baseDraftRevision: 0,
        startedAt: new Date().toISOString(),
        outcome: "running",
        validationErrors: [],
      });
    });
    const restarted = new AuthoringStore(dir);
    await restarted.initialize();
    expect((await restarted.read(projectId)).attempts[0].outcome).toBe("interrupted");
  });

  it("requires the current question revision and a listed option", async () => {
    const { store, projectId } = await fixture();
    await runOperation(store, projectId, "analyze", "op-analyze-a", deps(reply(analysis)));
    const q = (await store.read(projectId)).questions[0];
    await expect(
      store.mutate(projectId, (p) => answerQuestion(p, q.id, { questionRevision: 2, optionId: "generalization" }, "r")),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.mutate(projectId, (p) => answerQuestion(p, q.id, { questionRevision: 1, response: "아무거나" }, "r")),
    ).rejects.toMatchObject({ status: 400 });
    const d = await store.mutate(projectId, (p) => answerQuestion(p, q.id, { questionRevision: 1, optionId: "generalization" }, "r"));
    expect(d.response).toBe("새 자료 적용");
    expect((await store.read(projectId)).questions[0].status).toBe("answered");
    await runOperation(store, projectId, "analyze", "op-analyze-b", deps(reply(analysis)));
    expect((await store.read(projectId)).questions).toHaveLength(2);
  });

  it("applies a round of answers all or none, with 기타 text and deferral", async () => {
    const { store, projectId } = await fixture();
    await runOperation(store, projectId, "analyze", "op-analyze-all", deps(reply(analysis)));
    const [scope, code] = (await store.read(projectId)).questions;
    // One bad item (scope is choice-only and gets free text): nothing is stored.
    await expect(
      store.mutate(projectId, (p) =>
        answerAll(
          p,
          [
            { questionId: code.id, questionRevision: 1, response: "필요한 스크립트만" },
            { questionId: scope.id, questionRevision: 1, response: "둘 다" },
          ],
          "r",
        ),
      ),
    ).rejects.toBeInstanceOf(AuthoringError);
    let p = await store.read(projectId);
    expect(p.decisions).toHaveLength(0);
    expect(p.questions.every((q) => q.status === "open")).toBe(true);
    const decisions = await store.mutate(projectId, (q) =>
      answerAll(
        q,
        [
          { questionId: scope.id, questionRevision: 1, optionId: "generalization" },
          { questionId: code.id, questionRevision: 1, response: "필요한 스크립트만" },
        ],
        "r",
      ),
    );
    expect(decisions.map((d) => d.response)).toEqual(["새 자료 적용", "필요한 스크립트만"]);
    p = await store.read(projectId);
    expect(p.questions.map((q) => q.status)).toEqual(["answered", "answered"]);
    const deferred = await store.mutate(projectId, (q) => answerAll(q, [{ questionId: code.id, questionRevision: 1, defer: true }], "r"));
    expect(deferred[0].status).toBe("deferred");
    p = await store.read(projectId);
    expect(p.decisions.filter((d) => !d.supersededBy).map((d) => d.status)).toEqual(["answered", "deferred"]);
  });

  it("drafts with vocabulary filtering, server-owned fields, a recipe and stale-base protection", async () => {
    const { store, projectId } = await fixture();
    await runOperation(store, projectId, "analyze", "op-analyze-d", deps(reply(analysis)));
    const attempt = await runOperation(store, projectId, "draft", "op-draft-1", deps(reply(draftReply)));
    expect(attempt.outcome, JSON.stringify(attempt.validationErrors)).toBe("accepted");
    let p = await store.read(projectId);
    const d = p.drafts[0];
    expect(d.revision).toBe(1);
    expect(d.profile.taxonomy.disciplines).toEqual(["mineral-exploration-mpm"]);
    expect(d.notes.some((n) => n.includes("publisher"))).toBe(true);
    expect(d.notes.some((n) => n.includes("made-up"))).toBe(true);
    expect(d.workflow?.skillIds).toEqual(["local:pu-nested-cv-method"]);
    expect(d.workflow?.expectedArtifacts[0].files).toEqual(["outputs/scores.csv"]);
    expect(d.recipe).toEqual({ choices: { "block-size": "km50" }, unresolvedChoices: ["label-def"] });
    expect(d.evidence[0].findingIds).toHaveLength(1);
    expect(d.profile.procedure.edges).toHaveLength(2);
    // A researcher edit during a model draft wins; the model result is not applied.
    const racing: ChatFn = async () => {
      await store.mutate(projectId, (q) => {
        q.drafts.push(editDraft(q, { baseRevision: 1, title: "연구자 수정" }));
      });
      return { content: JSON.stringify(draftReply), finishReason: "stop" };
    };
    const stale = await runOperation(store, projectId, "draft", "op-draft-2", deps(racing));
    expect(stale.outcome).toBe("rejected");
    p = await store.read(projectId);
    expect(p.drafts).toHaveLength(2);
    expect((p.drafts[1].profile.title as { ko: string }).ko).toBe("연구자 수정");
    expect(() => editDraft(p, { baseRevision: 1, title: "x" })).toThrow(AuthoringError);
    const bad = { ...draftReply, workflow: { ...draftReply.workflow, environmentProfile: "conda-anything" } };
    const rejected = await runOperation(store, projectId, "draft", "op-draft-3", deps(reply(bad, bad)));
    expect(rejected.outcome).toBe("rejected");
    expect(rejected.validationErrors[0].join("\n")).toMatch(/environmentProfile/);
  });

  it("refuses links and parent paths in code archives without external tools", async () => {
    const { store, projectId } = await fixture();
    const w = await work("authoring-tar-");
    await mkdir(join(w, "repo/scripts"), { recursive: true });
    await writeFile(join(w, "repo/scripts/run.py"), 'print("hi")\n');
    await writeFile(join(w, "repo/README.md"), "# repo\n");
    execFileSync("tar", ["-czf", join(w, "good.tar.gz"), "-C", w, "repo"]);
    const good = await addSource(store, projectId, {
      name: "good.tar.gz",
      mediaType: "application/gzip",
      contentBase64: (await readFile(join(w, "good.tar.gz"))).toString("base64"),
    });
    expect(good.source.kind).toBe("code");
    expect(good.extraction.files?.map((f) => f.path)).toEqual(["README.md", "scripts/run.py"]);
    await symlink("/etc/passwd", join(w, "repo/link"));
    execFileSync("tar", ["-czf", join(w, "link.tar.gz"), "-C", w, "repo"]);
    const linked = await addSource(store, projectId, {
      name: "link.tar.gz",
      mediaType: "application/gzip",
      contentBase64: (await readFile(join(w, "link.tar.gz"))).toString("base64"),
    });
    expect(linked.source.status).toBe("failed");
    expect(linked.extraction.error ?? "").toMatch(/링크/);
    expect(store.exists(projectId, `sources/${linked.source.id}/files/link`)).toBe(false);
    execFileSync("tar", ["-czf", join(w, "up.tar.gz"), "-C", join(w, "repo/scripts"), "--transform", "s,^,../,", "run.py"]);
    const up = await addSource(store, projectId, {
      name: "up.tar.gz",
      mediaType: "application/gzip",
      contentBase64: (await readFile(join(w, "up.tar.gz"))).toString("base64"),
    });
    expect(up.source.status).toBe("failed");
    expect(up.extraction.error ?? "").toMatch(/경로/);
    // zip: the same layout through adm-zip
    execFileSync("python3", ["-I", "-c", "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2], 'repo/scripts')", join(w, "code"), w]);
    const zipped = await addSource(store, projectId, {
      name: "code.zip",
      mediaType: "application/zip",
      contentBase64: (await readFile(join(w, "code.zip"))).toString("base64"),
    });
    expect(zipped.source.kind).toBe("code");
    expect(zipped.extraction.files?.map((f) => f.path)).toEqual(["scripts/run.py"]);
  });

  it("keeps supplied code layout under scripts/upstream and refuses data files", async () => {
    const { store, projectId } = await fixture();
    const w = await work("authoring-code-");
    await mkdir(join(w, "repo/scripts"), { recursive: true });
    await mkdir(join(w, "repo/config"), { recursive: true });
    await writeFile(join(w, "repo/scripts/run.py"), 'open("../config/config.yaml")\n');
    await writeFile(join(w, "repo/config/config.yaml"), "block_km: 50\n");
    await writeFile(join(w, "repo/data.bin"), Buffer.from([0, 1, 2, 3]));
    execFileSync("tar", ["-czf", join(w, "code.tar.gz"), "-C", w, "repo"]);
    await addSource(store, projectId, {
      name: "code.tar.gz",
      mediaType: "application/gzip",
      contentBase64: (await readFile(join(w, "code.tar.gz"))).toString("base64"),
    });
    await runOperation(store, projectId, "analyze", "op-code-analyze", deps(reply(analysis)));
    const withCode = {
      ...draftReply,
      codeFiles: [
        { source: "S2", sourcePath: "scripts/run.py", path: "scripts/elsewhere.py" },
        { source: "S2", sourcePath: "config/config.yaml" },
      ],
    };
    const ok = await runOperation(store, projectId, "draft", "op-code-draft", deps(reply(withCode)));
    expect(ok.outcome, JSON.stringify(ok.validationErrors)).toBe("accepted");
    const d = (await store.read(projectId)).drafts[0];
    expect(d.codeFiles.map((c) => c.path)).toEqual(["scripts/upstream/scripts/run.py", "scripts/upstream/config/config.yaml"]);
    const data = { ...draftReply, codeFiles: [{ source: "S2", sourcePath: "data.bin" }] };
    const refused = await runOperation(store, projectId, "draft", "op-code-data", deps(reply(data, data)));
    expect(refused.outcome).toBe("rejected");
    expect(refused.validationErrors[0].join("\n")).toMatch(/data or binary/);
  });

  it("revises from feedback, keeps omitted code files, labels options and declares imports (joblib bundled)", async () => {
    const { store, projectId } = await fixture();
    const w = await work("authoring-revise-");
    await mkdir(join(w, "repo/scripts"), { recursive: true });
    await writeFile(join(w, "repo/scripts/run.py"), "import skgstat\nimport joblib\nimport sklearn\n");
    execFileSync("tar", ["-czf", join(w, "code.tar.gz"), "-C", w, "repo"]);
    await addSource(store, projectId, {
      name: "code.tar.gz",
      mediaType: "application/gzip",
      contentBase64: (await readFile(join(w, "code.tar.gz"))).toString("base64"),
    });
    await runOperation(store, projectId, "analyze", "op-rev-analyze", deps(reply(analysis)));
    const withCode = {
      ...draftReply,
      codeFiles: [{ source: "S2", sourcePath: "scripts/run.py" }],
      instructions: "# 방법\n\n`uv run --with scikit-gstat python <skill>/scripts/upstream/scripts/run.py`",
      workflow: {
        ...draftReply.workflow,
        requiredScientificChoices: [
          {
            id: "block-size",
            label: "block 크기",
            why: "누출 정도",
            options: [
              { id: "variogram", label: "바리오그램으로 제안" },
              { id: "fixed", label: "직접 지정" },
            ],
          },
        ],
      },
      recipe: null,
    };
    const first = await runOperation(store, projectId, "draft", "op-rev-draft", deps(reply(withCode)));
    expect(first.outcome, JSON.stringify(first.validationErrors)).toBe("accepted");
    let d = (await store.read(projectId)).drafts[0];
    expect(d.workflow?.requiredScientificChoices[0].optionLabels).toEqual({
      variogram: { ko: "바리오그램으로 제안" },
      fixed: { ko: "직접 지정" },
    });
    const declared = (d.profile.dependencies ?? []).map((x) => x.name);
    expect(declared).toContain("scikit-gstat");
    expect(declared).toContain("scikit-learn");
    expect(declared).not.toContain("joblib");
    await expect(runOperation(store, projectId, "revise", "op-rev-none", deps(reply(withCode)))).rejects.toMatchObject({
      status: 400,
    });
    const { codeFiles: _omit, ...withoutCode } = withCode;
    const revised = await runOperation(store, projectId, "revise", "op-rev-1", {
      ...deps(reply({ ...withoutCode, summary: "바리오그램 표본 상한을 적었습니다." })),
      feedback: "바리오그램이 7만 셀 전체로 45분 넘게 돌았습니다.",
    });
    expect(revised.outcome, JSON.stringify(revised.validationErrors)).toBe("accepted");
    expect(revised.feedback).toBe("바리오그램이 7만 셀 전체로 45분 넘게 돌았습니다.");
    d = (await store.read(projectId)).drafts[1];
    expect(d.revision).toBe(2);
    expect(d.codeFiles.map((c) => c.path)).toEqual(["scripts/upstream/scripts/run.py"]);
  });
});

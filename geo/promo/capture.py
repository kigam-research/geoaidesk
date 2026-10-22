"""Capture the real-system takes for the GAID promo film (contract: geo/promo/CONTRACT.md, take `capture-v1`).

Frame time is film time: every frame is a screenshot after a real pointer step; waits for loading after a click are
cut and recorded. The pointer is drawn (no OS cursor), hover states come from real mouse moves along the same path.
No model calls: requests that would start a run, send answers or change hub records are aborted and listed.

    uv run --no-project --with playwright==1.63.0 --with pillow==12.3.0 python geo/promo/capture.py \
        [--base http://localhost:3320] [--out ~/data/geoaidesk/work/gaid-promo-video/capture-v1] [--only H1,R3] [--inspect]

The instance must run from this worktree with GAID_HOME = the curated copy made by capture_data.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

WORK = Path.home() / "data/geoaidesk/work/gaid-promo-video"
CSS_W, CSS_H, SCALE = 1280, 720, 2.25
FPS = 30
PX_W, PX_H = round(CSS_W * SCALE), round(CSS_H * SCALE)

INIT = """
try {
  localStorage.setItem('gaid:locale','ko');
  localStorage.setItem('gaid:hub-user','연구자 김');
  localStorage.setItem('theme','light');
  localStorage.setItem('gaid:style','instrument');
} catch (e) {}
document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = '*{cursor:none!important} #capture-pointer{pointer-events:none!important}';
  document.head.appendChild(s);
});
"""

# Writes that would call a model, send answers, register or install. Aborted and listed; nothing else is blocked.
BLOCK = re.compile(r"/run$|/steer|/follow-up|/interview|/answers|/send|/revise|/apply|/register|/install|/visuals"
                   r"|/generate|/prompt|/compact|/handoffs|/edit$|/star|/comments")

# Capture-instance artefact only: no credentials were copied, so the composer marks the stored chat's model as not
# connected. That word is hidden in frames (the model chip itself stays).
MASK = r"""() => {
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT), ns=[];
 while(w.nextNode())ns.push(w.currentNode);
 for(const n of ns){ if(['연결 안 됨','Zotero 연결 안 됨'].includes(n.nodeValue.trim()) && n.parentElement) n.parentElement.style.visibility='hidden'; }
}"""

DRAW = """([p,a]) => {
 let o=document.getElementById('capture-pointer');
 if(!o){o=document.createElement('div');o.id='capture-pointer';
  o.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  o.innerHTML='<svg width="100%" height="100%" style="overflow:visible;position:absolute;inset:0"><g id="capture-ripple"></g><g id="capture-arrow"><path d="M0 0 L0 22 L5.6 16.4 L10.4 27.2 L15.2 24.8 L10.4 14.4 L19.2 14.4 Z" fill="#14213d" stroke="white" stroke-width="2" stroke-linejoin="round"/></g></svg>';
  document.body.appendChild(o);}
 o.querySelector('#capture-arrow').setAttribute('transform',`translate(${p.x} ${p.y})`);
 o.querySelector('#capture-ripple').innerHTML=a==null?'':`<circle cx="${p.x}" cy="${p.y}" r="${8+22*a}" fill="none" stroke="#2f6bff" stroke-width="${2.5*(1-a)}" opacity="${0.9*(1-a)}"/>`;
}"""


def rect_of(loc, timeout=10000):
    b = loc.bounding_box(timeout=timeout)
    if not b:
        raise RuntimeError(f"not visible: {loc}")
    return {k: round(b[k], 1) for k in ("x", "y", "width", "height")}


def center(r):
    return {"x": r["x"] + r["width"] / 2, "y": r["y"] + r["height"] / 2}


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


class Take:
    def __init__(self, page, out: Path, sid: str, log):
        self.page, self.sid, self.log = page, sid, log
        self.dir = out / "shots" / sid
        self.dir.mkdir(parents=True, exist_ok=False)
        self.k = 0
        self.pt = {"x": CSS_W * 0.62, "y": CSS_H * 0.55}
        self.last_click = -100
        self.actions, self.focus, self.cuts, self.stills = [], [], [], []

    @property
    def t(self):
        return round(self.k / FPS, 3)

    def frame(self):
        self.page.evaluate(MASK)
        a = (self.k - self.last_click) / 14 if self.k - self.last_click < 14 else None
        self.page.evaluate(DRAW, [self.pt, a])
        self.page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        self.page.screenshot(path=str(self.dir / f"frame-{self.k:05d}.png"), animations="disabled")
        self.k += 1

    def hold(self, n):
        for _ in range(n):
            self.frame()

    def move(self, target, n, label=None, hover=True):
        """Move the pointer to a locator centre or a point over n frames (real mouse moves)."""
        r = None
        if isinstance(target, dict):
            end = target
        else:
            r = rect_of(target)
            end = center(r)
        start = dict(self.pt)
        for i in range(1, n + 1):
            u = smooth(i / n)
            self.pt = {"x": start["x"] + (end["x"] - start["x"]) * u, "y": start["y"] + (end["y"] - start["y"]) * u}
            if hover:
                self.page.mouse.move(self.pt["x"], self.pt["y"])
            self.frame()
        if label:
            self.actions.append({"t": self.t, "kind": "hover", "target": label, "rect": r})
        return r

    def click(self, label, rect=None, settle=1.2, wait=None):
        self.page.mouse.click(self.pt["x"], self.pt["y"])
        self.last_click = self.k
        self.actions.append({"t": self.t, "kind": "click", "target": label, "rect": rect})
        t0 = time.monotonic()
        if wait:
            wait()
        self.page.wait_for_timeout(int(settle * 1000))
        self.cuts.append({"t": self.t, "after": label, "omitted_wall_s": round(time.monotonic() - t0, 2)})

    def wheel(self, dy, n, label=None):
        for _ in range(n):
            self.page.mouse.wheel(0, dy / n)
            self.page.wait_for_timeout(40)
            self.frame()
        self.actions.append({"t": self.t, "kind": "scroll", "target": label or f"wheel {dy}px", "rect": None})

    def mark(self, label, loc_or_rect):
        try:
            r = loc_or_rect if isinstance(loc_or_rect, dict) else rect_of(loc_or_rect, 4000)
        except Exception:
            r = {"x": 0, "y": 0, "width": CSS_W, "height": CSS_H}
            label += " (whole viewport)"
        self.focus.append({"t": self.t, "rect": r, "label": label})
        return r

    def record(self, url):
        return {"id": self.sid, "frames": self.k, "pattern": f"shots/{self.sid}/frame-%05d.png", "url": url,
                "actions": self.actions, "focus": self.focus, "cuts": self.cuts}


# ---------------------------------------------------------------- helpers for app navigation (not filmed)

def settle(page, ms=800):
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(ms)


def open_project(page, base, name):
    page.goto(base + "/", wait_until="domcontentloaded")
    page.get_by_role("button", name=f"{name} 프로젝트 열기").click()
    settle(page, 1500)


def no_text(page, text, timeout=120000):
    page.wait_for_function(f"() => !document.body.innerText.includes({json.dumps(text)})", timeout=timeout)


def open_file(page, parts):
    for p in parts[:-1]:
        page.get_by_text(p, exact=True).first.click()
        page.wait_for_timeout(500)
    page.get_by_text(parts[-1], exact=True).first.click()
    settle(page, 2500)


# ---------------------------------------------------------------- shots

def end(take, target):
    take.hold(max(12, target - take.k))


def shot_H1(page, base, take):
    page.goto(base + "/#hub", wait_until="domcontentloaded")
    settle(page, 1500)
    main = page.get_by_role("main")
    card = main.get_by_text("PU-컨포멀 탐사 우선순위 존 분류", exact=True).first
    take.mark("추천 Workflow 카드", main.locator("section, div").filter(has_text="추천 Workflow").filter(
        has_text="분석값 검열 점검").last)
    take.hold(12)
    r = take.move(card, 22, "추천 Workflow 카드 제목")
    take.hold(4)
    take.click("Workflow 열기", r, settle=1.5)
    take.mark("Workflow 머리 카드 (개념 그림, 2판)", main.locator("div").filter(
        has_text="내 프로젝트에서 시험").filter(has_text="2판").last)
    take.hold(8)
    take.move({"x": 700, "y": 420}, 14)
    take.wheel(780, 22, "Workflow 단계로 스크롤")
    settle(page, 300)
    s2 = main.get_by_text("라벨 희소성·PU 타당성 점검", exact=True).first
    r2 = take.move(s2, 14, "단계 2")
    take.click("단계 2 열기", r2, settle=0.6)
    take.mark("Workflow 단계 목록과 단계 상세 (사용 스킬)", main.locator("div").filter(
        has_text="단계 2 / 10").filter(has_text="격자 표 입력·검증").last)
    take.stills += [("hub-workflow-steps.png", main.locator("div").filter(has_text="단계 2 / 10").filter(
        has_text="격자 표 입력·검증").last), ("hub-concept-picture.png", main.locator("img").first)]
    end(take, 150)


def shot_R1(page, base, take):
    open_project(page, base, "Yilgarn 니켈 탐사 우선순위")
    page.get_by_role("button", name="Workflow").first.click()
    no_text(page, "읽는 중입니다")
    settle(page, 800)
    row = page.get_by_text("격자 표 탐사 우선순위 존 산출", exact=True).first
    take.mark("Workflow 패널", page.locator("div").filter(has_text="허브에서 설치한 Workflow").filter(
        has_text="기본 Workflow").last)
    take.hold(10)
    r = take.move(row, 16, "Workflow 행")
    take.click("Workflow 시작 설정 열기", r, settle=1.5)
    dialog = page.get_by_role("dialog")
    take.mark("시작 설정 (단계 눈금)", dialog)
    take.hold(4)
    r = take.move(dialog.get_by_text(re.compile(r"^격자 표\(예")).first, 14, "입력 파일 단계")
    take.click("입력 파일 단계", r, settle=0.8)
    take.hold(10)
    r = take.move(dialog.get_by_text("실행 규모", exact=True).first, 14, "분석 조건 단계")
    take.click("분석 조건 단계 (실행 규모)", r, settle=0.8)
    take.hold(10)
    r = take.move(dialog.get_by_role("button", name="요약 보기"), 12, "요약 보기")
    take.click("요약 보기", r, settle=0.8)
    take.hold(4)
    r = take.move(dialog.get_by_role("button", name="시작 초안 만들기"), 14, "시작 초안 만들기 (누르지 않음)")
    take.mark("요약과 시작 동작", dialog)
    take.mark("시작 초안 만들기", r)
    take.stills.append(("workflow-start-summary.png", dialog))
    end(take, 135)


def shot_R2(page, base, take):
    open_project(page, base, "Yilgarn 니켈 탐사 우선순위")
    open_file(page, ["outputs", "variogram_fit.png"])
    page.get_by_role("button", name="파일 목록 숨기기").click()
    sep = page.locator('[role="separator"]').last
    b = sep.bounding_box()
    if b:
        page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
        page.mouse.down()
        page.mouse.move(560, b["y"] + b["height"] / 2, steps=8)
        page.mouse.up()
    page.get_by_role("button", name="대화 기록").click()
    settle(page, 600)
    page.get_by_text("이 격자 표로").first.click()
    settle(page, 2500)
    head = page.get_by_text("QA + variogram gate — Yilgarn_GIS_DB.csv", exact=False).first
    head.scroll_into_view_if_needed()
    page.mouse.move(1000, 300)
    page.mouse.wheel(0, -120)
    settle(page, 500)
    take.mark("AI agent 결과 카드", head)
    take.hold(10)
    take.move({"x": 1000, "y": 380}, 12)
    take.wheel(360, 20, "결과 카드 읽기")
    link = page.get_by_text("Variogram fit (Ni_mine)", exact=True).first
    r = take.move(link, 16, "관련 파일: 변이함수 그림 (열려 있는 그림)")
    take.hold(6)
    fig = page.locator("img").filter(has_not=page.locator("xpath=ancestor::*[@role='dialog']")).first
    take.mark("결과 그림 (outputs/variogram_fit.png)", {"x": 0, "y": 52, "width": 560, "height": 668})
    take.move({"x": 300, "y": 380}, 18, "결과 그림")
    end(take, 120)


NOTE_LITHO = "서울 1:25만 암상도 암상(LITHONAME)별 면적표와 암상별 색상 지도"
NOTE_CV = "공간 교차검증의 블록 크기와 거리 선택: 첨부 논문 세 편 비교"


def open_notes(page, base, project):
    open_project(page, base, project)
    page.get_by_role("button", name="대화 숨기기").click()
    page.get_by_role("button", name="연구 노트").first.click()
    settle(page, 1200)


def shot_R3(page, base, take):
    open_notes(page, base, "서울 지질도 암상 면적")
    take.mark("연구노트 목록 (결정할 일, 검토 전)", page.get_by_role("main"))
    take.hold(10)
    r = take.move(page.get_by_text(re.compile(r"^서울지역 1:25만 암상도 133개")).first, 18, "연구노트")
    take.click("연구노트 열기", r, settle=1.5)
    block = page.locator("div").filter(has_text="결정할 일").filter(has_text="답변 보내기").last
    take.hold(6)
    take.move({"x": 640, "y": 420}, 8)
    by = block.bounding_box()["y"]
    take.wheel(max(0, by - 175), 18, "결정 블록으로 스크롤")
    settle(page, 300)
    take.mark("결정 블록", block)
    take.stills.append(("note-decision-block.png", block))
    take.hold(4)
    opt = block.locator("label, [role=radio]").first
    r = take.move(opt, 18, "선택지")
    take.click("선택지 고르기 (보내지 않음)", r, settle=0.4)
    take.hold(8)
    take.move(page.get_by_role("button", name="다음 결정"), 14, "다음 결정 (누르지 않음)")
    end(take, 120)


def shot_R6(page, base, take):
    open_notes(page, base, "문헌 근거 공간 교차검증")
    page.get_by_text(NOTE_CV, exact=True).last.click()
    settle(page, 1500)
    para = page.get_by_text("자기상관 범위는 무엇에서 구합니까?", exact=True).first
    para.scroll_into_view_if_needed()
    page.mouse.move(640, 400)
    page.mouse.wheel(0, -40)
    settle(page, 500)
    cite = page.get_by_text(re.compile(r"\[@valavi2018, pp\. 11–12\]")).first
    take.mark("쪽수 인용이 있는 문단", cite)
    take.hold(10)
    take.move(cite, 18, "쪽수 인용 [@valavi2018, pp. 11–12]")
    take.hold(24)
    take.move({"x": 640, "y": 470}, 10)
    take.wheel(2600, 34, "참고문헌으로 스크롤")
    settle(page, 400)
    refs = page.get_by_text("참고문헌", exact=True).last.locator("xpath=..")
    take.mark("서재에서 만든 참고문헌", refs)
    take.stills.append(("note-references.png", refs))
    take.move(page.get_by_text("@ploton2020", exact=True).last, 14, "참고문헌 항목")
    end(take, 180)


def open_litho_map(page, base):
    open_project(page, base, "서울 지질도 암상 면적")
    page.get_by_role("button", name="대화 숨기기").click()
    open_file(page, ["user_data", "samples", "vector", "seoul_geology_250k", "Seoul_Geology_250K_Litho.shp"])
    page.get_by_role("button", name="파일 목록 숨기기").click()
    settle(page, 1000)


def map_viewport(page):
    return page.locator(".ol-viewport").first


def shot_M1(page, base, take):
    open_litho_map(page, base)
    page.get_by_role("combobox").filter(has_text="배경지도 없음").first.click()
    page.get_by_role("option", name="NGII 바로e맵 영상지도").click()
    settle(page, 2500)
    page.get_by_text("표시 설정").first.click()
    page.get_by_text("범주형 색상").first.click()
    settle(page, 600)
    pick_field(page, "LITHONAME")
    settle(page, 3000)
    mapr = take.mark("지도 화면 (암상 LITHONAME 분류색, 바로e맵 영상지도 배경)", map_viewport(page))
    take.stills.append(("map-litho.png", map_viewport(page)))
    take.hold(14)
    kigam = page.get_by_text("KIGAM 1:5만 지질도", exact=True).first
    r = take.move(kigam, 18, "KIGAM 1:5만 지질도")
    take.click("KIGAM 1:5만 지질도 겹치기", r, settle=4.0)
    take.mark("KIGAM 1:5만 지질도를 겹친 지도", mapr)
    take.hold(4)
    c = center(mapr)
    take.move({"x": c["x"], "y": c["y"]}, 18)
    take.hold(20)
    r = take.move(kigam, 16, "KIGAM 1:5만 지질도")
    take.click("KIGAM 1:5만 지질도 끄기", r, settle=2.0)
    take.move({"x": c["x"] + 70, "y": c["y"] - 10}, 16, "지질 단위")
    take.click("피처 속성 보기", None, settle=1.2)
    take.mark("선택한 피처의 속성 (LITHONAME)", page.get_by_text("선택한 피처의 속성", exact=True).locator("xpath=../.."))
    end(take, 165)


def pick_field(page, field, placeholder="필드 선택"):
    """Pick a field in the nearest field select (native select or listbox)."""
    for sel in page.locator("select").all():
        opts = [o.inner_text().strip() for o in sel.locator("option").all()]
        if field in opts:
            sel.select_option(label=field)
            return
    page.get_by_role("combobox").filter(has_text=placeholder).last.click()
    page.get_by_role("option", name=field, exact=True).first.click()


def shot_M2(page, base, take):
    open_litho_map(page, base)
    page.get_by_text("표시 설정").first.click()
    page.get_by_text("범주형 색상").first.click()
    settle(page, 600)
    pick_field(page, "LITHONAME")
    settle(page, 2000)
    page.get_by_text("표시 설정").first.click()
    page.get_by_text("전체 레이어 면적표").first.click()
    settle(page, 500)
    pick_field(page, "LITHONAME")
    settle(page, 400)
    panel = page.get_by_text("면적 분류 필드", exact=True).locator("xpath=../..")
    take.mark("레이어 속성표", page.get_by_text("레이어 속성표", exact=True).locator("xpath=../.."))
    take.hold(10)
    pick_field(page, "타원체 측지 면적", "계산 방법 선택")
    settle(page, 400)
    take.move(page.get_by_role("combobox").filter(has_text="타원체 측지 면적").first, 16,
              "면적 계산 방법 (타원체 측지 면적)")
    take.hold(6)
    btn = page.get_by_role("button", name="전체 면적 계산")
    r = take.move(btn, 14, "전체 면적 계산")
    take.click("전체 면적 계산", r, settle=1.0, wait=lambda: no_text(page, "계산하는 중", 120000))
    take.mark("암상별 면적표 (전체 레이어)", panel)
    take.move({"x": r["x"] + 60, "y": 430}, 12)
    take.wheel(420, 20, "면적표 보기")
    take.mark("암상별 면적표 (계산 결과)", {"x": r["x"] - 20, "y": 120, "width": CSS_W - r["x"] + 20, "height": 600})
    end(take, 120)


def shot_R5(page, base, take):
    open_project(page, base, "25/9-1 검층 그림")
    page.get_by_role("button", name="대화 숨기기").click()
    open_file(page, ["user_data", "25_9-1.las"])
    page.get_by_role("button", name="파일 목록 숨기기").click()
    settle(page, 2000)
    svg = page.locator("svg").filter(has_text="GR [gAPI]").first
    svg.scroll_into_view_if_needed()
    page.mouse.wheel(0, 200)
    settle(page, 600)
    tr = take.mark("검층 트랙 (GR, RHOB, NPHI, DTC)", svg)
    take.stills.append(("depth-tracks.png", svg))
    take.hold(8)
    take.move({"x": tr["x"] + tr["width"] * 0.22, "y": tr["y"] + 120}, 14, "GR 트랙")
    take.move({"x": tr["x"] + tr["width"] * 0.62, "y": tr["y"] + 260}, 40, "트랙을 따라 이동")
    take.move({"x": tr["x"] + tr["width"] * 0.82, "y": tr["y"] + 330}, 24, "DTC 트랙")
    end(take, 105)


def open_library(page, base):
    page.goto(base + "/#library", wait_until="domcontentloaded")
    settle(page, 2000)


def shot_L1(page, base, take):
    open_library(page, base)
    take.mark("서재 (폴더, 논문, 쓰인 곳)", page.get_by_role("main"))
    take.hold(12)
    r = take.move(page.get_by_role("button", name=re.compile("공간 검증")).first, 18, "폴더")
    take.click("폴더 열기", r, settle=1.0)
    take.hold(8)
    r = take.move(page.get_by_text("Spatial validation reveals poor predictive performance", exact=False).first, 18,
                  "논문")
    take.click("논문 열기", r, settle=1.5)
    take.mark("논문 상세 (폴더, 내 연구에서 쓰인 곳)", page.get_by_text("내 연구에서 쓰인 곳", exact=True).locator(
        "xpath=../.."))
    take.move(page.get_by_text("내 연구에서 쓰인 곳", exact=True).first, 16, "내 연구에서 쓰인 곳")
    take.move({"x": take.pt["x"] + 60, "y": take.pt["y"] + 110}, 24)
    end(take, 150)


def shot_L2(page, base, take):
    open_library(page, base)
    page.get_by_text("Spatial validation reveals poor predictive performance", exact=False).first.click()
    settle(page, 1500)
    take.mark("논문이 쓰인 프로젝트와 노트", page.get_by_text("내 연구에서 쓰인 곳", exact=True).locator("xpath=../.."))
    take.hold(10)
    r = take.move(page.get_by_role("button", name="연결 지도 열기").first, 18, "연결 지도 열기")
    take.click("연결 지도 열기", r, settle=2.0)
    take.mark("연결 지도", page.get_by_role("dialog").last)
    take.stills.append(("connection-map.png", page.get_by_role("dialog").last))
    take.hold(10)
    r = take.move(page.get_by_text("2단계", exact=True).first, 16, "2단계")
    take.click("2단계 연결 보기", r, settle=1.5)
    take.hold(6)
    take.move({"x": 560, "y": 400}, 20)
    end(take, 135)


SHOTS = {"H1": shot_H1, "R1": shot_R1, "R2": shot_R2, "R3": shot_R3, "R5": shot_R5, "M1": shot_M1,
         "M2": shot_M2, "L1": shot_L1, "R6": shot_R6, "L2": shot_L2}

STILL_FILES = {  # real result figures, copied byte for byte from the capture home
    "result-variogram-fit.png": "projects/proj-035916/sandbox/outputs/variogram_fit.png",
    "result-seoul-litho-map.png": "projects/review-notebook/sandbox/연구노트/2026-10-18-seoul-250k-litho-area-map/figures/seoul_litho_map.png",
    "result-25-9-1-logs.png": "projects/proj-bc576f/sandbox/figures/Figure_1_25_9_1_logs.png",
}


def sha(p: Path):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://localhost:3320")
    ap.add_argument("--out", type=Path, default=WORK / "capture-v1")
    ap.add_argument("--home", type=Path, default=WORK / "home")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    out = args.out.expanduser()
    only = [s for s in args.only.split(",") if s] or list(SHOTS)
    out.mkdir(parents=True, exist_ok=True)
    (out / "stills").mkdir(exist_ok=True)
    errors, blocked, nonget, still_rows = [], [], [], []
    shots = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome",
                                     args=["--no-sandbox", "--disable-dev-shm-usage"])
        for sid in only:
            ctx = browser.new_context(viewport={"width": CSS_W, "height": CSS_H}, device_scale_factor=SCALE,
                                      locale="ko-KR", timezone_id="Asia/Seoul", color_scheme="light")
            ctx.add_init_script(INIT)

            def guard(route, _request=None, sid=sid):
                req = route.request
                if req.method != "GET":
                    nonget.append({"shot": sid, "method": req.method, "url": req.url})
                    if BLOCK.search(req.url.split("?")[0]):
                        blocked.append({"shot": sid, "method": req.method, "url": req.url})
                        return route.abort()
                route.continue_()

            ctx.route("**/*", guard)
            page = ctx.new_page()
            page.on("pageerror", lambda e, sid=sid: errors.append(f"{sid} pageerror {e}"))
            page.on("console", lambda m, sid=sid: errors.append(f"{sid} console {m.text}") if m.type == "error" else None)
            shot_dir = out / "shots" / sid
            if shot_dir.exists():
                shutil.rmtree(shot_dir)
            take = Take(page, out, sid, print)
            t0 = time.monotonic()
            try:
                SHOTS[sid](page, args.base, take)
            except Exception:
                page.screenshot(path=str(out / f"failure-{sid}.png"))
                raise
            rec = take.record(page.url)
            rec["wall_s"] = round(time.monotonic() - t0, 1)
            shots.append(rec)
            print(f"{sid}: {take.k} frames ({take.k / FPS:.2f} s)", flush=True)
            for name, loc in take.stills:
                try:
                    loc.screenshot(path=str(out / "stills" / name))
                    still_rows.append({"name": name, "source": f"shot {sid}", "kind": "element crop at scale 2.25"})
                except Exception as exc:  # a still is optional; the frames are the take
                    errors.append(f"{sid} still {name}: {exc}")
            ctx.close()
        browser.close()

    stills = list(still_rows)
    for name, rel in STILL_FILES.items():
        src = args.home.expanduser() / rel
        shutil.copyfile(src, out / "stills" / name)
        stills.append({"name": name, "source": f"GAID_HOME/{rel}", "kind": "result figure (file copy)",
                       "sha256": sha(out / "stills" / name)})

    from PIL import Image

    verify = {}
    for rec in shots:
        files = sorted((out / "shots" / rec["id"]).glob("frame-*.png"))
        sizes = {Image.open(f).size for f in files}
        verify[rec["id"]] = {"frames": len(files), "declared": rec["frames"], "sizes": sorted(sizes)}
        if len(files) != rec["frames"] or sizes != {(PX_W, PX_H)}:
            raise RuntimeError(f"frame check failed for {rec['id']}: {verify[rec['id']]}")
    prev = out / "capture.json"
    old = json.loads(prev.read_text()) if prev.exists() else {}
    merged = {s["id"]: s for s in old.get("shots", [])}
    merged.update({s["id"]: s for s in shots})
    order = [s for s in SHOTS if s in merged]
    data_rec = WORK / "capture-v1-data.json"
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    doc = {
        "schema": "gaid-promo-capture-v1",
        "fps": FPS, "width": PX_W, "height": PX_H, "css": {"width": CSS_W, "height": CSS_H, "scale": SCALE},
        "created_utc": datetime.now(UTC).isoformat(),
        "app_commit": commit,
        "app_url": args.base,
        "shots": [merged[s] for s in order],
        "stills": list({**{x["name"]: x for x in old.get("stills", [])}, **{x["name"]: x for x in stills}}.values()),
        "data": json.loads(data_rec.read_text()) if data_rec.exists() else None,
        "dom_adaptations": ["status words '연결 안 됨' (composer model chip) and 'Zotero 연결 안 됨' (library header) "
                            "hidden: the capture instance has no credentials or Zotero connection file"],
        "requests": {"non_get": old.get("requests", {}).get("non_get", []) + nonget,
                     "blocked": old.get("requests", {}).get("blocked", []) + blocked},
        "browser_errors": old.get("browser_errors", []) + errors,
        "verification": {**old.get("verification", {}), **verify},
    }
    prev.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print(prev, "errors:", errors, "blocked:", blocked)


if __name__ == "__main__":
    main()

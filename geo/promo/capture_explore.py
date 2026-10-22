"""Explore the capture instance: open a URL, optionally click by role/name, save a screenshot and the visible text.

    uv run --no-project --with playwright==1.63.0 python geo/promo/capture_explore.py <name> <url> [js-steps-file]

The steps file holds Python statements run with `page` in scope (exploration only; the take is capture.py).
"""

from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path.home() / "data/geoaidesk/work/gaid-promo-video/capture-explore"
INIT = """
localStorage.setItem('gaid:locale','ko');
localStorage.setItem('gaid:hub-user','연구자 김');
localStorage.setItem('theme','light');
"""


def main():
    name, url = sys.argv[1], sys.argv[2]
    steps = Path(sys.argv[3]).read_text() if len(sys.argv) > 3 else ""
    OUT.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=1, locale="ko-KR",
                            timezone_id="Asia/Seoul", color_scheme="light")
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror {e}"))
        page.on("console", lambda m: errors.append(f"console {m.text}") if m.type == "error" else None)
        page.goto(url, wait_until="networkidle", timeout=180000)
        page.wait_for_timeout(1500)
        if steps:
            exec(steps, {"page": page, "OUT": OUT, "name": name})
            page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / f"{name}.png"))
        (OUT / f"{name}.txt").write_text(page.locator("body").inner_text() + "\n\nERRORS:\n" + "\n".join(errors))
        print(page.url)
        print("errors:", errors[:10])
        b.close()


if __name__ == "__main__":
    main()

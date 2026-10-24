"""One authorized retake after the first run's documented geometry failure.

Call record_retake only after the original run is terminal. The receipt guard
prevents a third model run. This module is loaded by the live controller.
"""
import asyncio
import json
from datetime import datetime, UTC

from live import Pointer, StreamRecorder, OUT
from scenario import stage_setup


async def record_retake(page):
    assert (OUT/'first-run-end.json').exists(), 'First run must finish before retake'
    assert not (OUT/'retake-start.json').exists(), 'Retake already started; never resend'
    d=await stage_setup(page)
    p=Pointer(page)
    p.pointer={'x':800,'y':580}
    from pointer import DRAW
    await page.evaluate(DRAW,[p.pointer,None])
    await page.evaluate('document.getElementById("capture-pointer").style.display="block"')
    ag1=StreamRecorder(page)
    ag1.pointer_provider=lambda:p.pointer
    await ag1.start('AG1-final')
    p.t0=ag1.t0
    await asyncio.sleep(1)
    rect=await p.move(d.get_by_role('button',name='시작 초안 만들기',exact=True),.6)
    await p.click('시작 초안 만들기',rect)
    ag1.actions=p.actions.copy()
    card=page.get_by_role('button',name='Workflow · 포천 자철석 광체 추정 · version 0.1.0: 지침 펼치기',exact=True)
    await card.wait_for(state='visible')
    (OUT/'ag1-card-rect.json').write_text(json.dumps({'t':__import__('time').monotonic()-ag1.t0,
        'rect':await card.bounding_box()},indent=2)+'\n')
    await asyncio.sleep(3)
    await ag1.stop()
    request=(OUT/'analysis-request.txt').read_text().replace('pgi_live_capture','pgi_live_retake').replace('2026-10-24-pgi-live-capture','2026-10-24-pgi-live-retake')
    request+='\n첫 실행의 촬영 배율 오류로 허용된 한 번의 재촬영입니다. 첫 실행 pgi_live_capture의 호환 수정 코드를 우선 재사용하되, pgi_live_retake에 전처리·기존 역산·네 PGI·설정 및 마스크 고정·평가·그림·점검을 모두 새로 계산합니다. 이전 출력 파일을 복사하지 않습니다. 세 번째 실행은 하지 않습니다.\n'
    (OUT/'retake-request.txt').write_text(request)
    await page.get_by_role('textbox').filter(visible=True).fill(request)
    run=StreamRecorder(page)
    run.pointer_provider=lambda:p.pointer
    await run.start('AG2-final')
    p.t0=run.t0; p.actions=[]
    rect=await p.move(page.get_by_role('button',name='요청 보내기',exact=True),.6)
    receipt={'startedAt':datetime.now(UTC).isoformat(),'streamStartedAt':run.started,
        'reason':'First run initial capture had incorrect native backing-view geometry',
        'runCount':2,'model':await page.get_by_role('button',name='모델 선택, 현재 GPT-6.1 Sol',exact=True).inner_text(),
        'workflow':'pocheon-pgi-magnetic-trial','version':'0.1.0'}
    (OUT/'retake-start.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    (OUT/'retake-status.json').write_text(json.dumps({'state':'recording','started':receipt},ensure_ascii=False,indent=2)+'\n')
    await p.click('실제 예제 분석 실행',rect)
    run.actions=p.actions.copy()
    await asyncio.sleep(.8)
    await page.evaluate('document.getElementById("capture-pointer").style.display="none"')
    run.pointer_provider=lambda:None
    while not await page.get_by_role('button',name='요청 보내기',exact=True).count():
        await asyncio.sleep(2)
    (OUT/'retake-end.json').write_text(json.dumps({'endedAt':datetime.now(UTC).isoformat(),
        'elapsedSeconds':__import__('time').monotonic()-run.t0,
        'finalText':await page.locator('body').inner_text()},ensure_ascii=False,indent=2)+'\n')
    await run.stop()
    return {'frames':len(run.rows),'elapsed':__import__('time').monotonic()-run.t0}

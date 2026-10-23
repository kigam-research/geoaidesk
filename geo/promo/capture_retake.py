"""Bounded R2 UI retake with parent-authorized, capture-only text substitutions.

Uses the existing project/session. No record text is edited. A single short citation request
runs on the same connected subscription model; this does not request analysis or training.
"""
from pathlib import Path
import json
import re
import shutil
import time
from playwright.sync_api import sync_playwright
from capture_study import StudyTake, OUT, WORK
from capture import rect_of

STAGE = """() => {
 const block=document.querySelector('[data-workflow-block]');
 if(block&&!block.dataset.captureText){
  [...block.children].filter(e=>e.tagName!=='BUTTON').forEach(e=>e.remove());
  const p=document.createElement('p');
  p.textContent='Workflow 지침에 따라 Yilgarn 자료로 탐사 우선순위 구역 지도와 연구노트를 만들어 주세요.';
  block.append(p);block.dataset.captureText='true';
 }
 for(const row of document.querySelectorAll('.is-user')){
  if(row.innerText.startsWith('최종 확인만 짧게'))row.firstElementChild.textContent='서재 논문 인용을 확인해 주세요.';
 }
 for(const p of document.querySelectorAll('.is-assistant p')){
  if(p.textContent.trim()==='새 분석은 수행하지 않았습니다.')p.remove();
 }
} """


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/google-chrome',
            args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=2.25,
            locale='ko-KR',color_scheme='light')
        ctx.add_init_script("localStorage.setItem('gaid:locale','ko');localStorage.setItem('theme','light');localStorage.setItem('gaid:style','instrument');")
        page=ctx.new_page();page.set_default_timeout(6000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(500)
        if page.get_by_text('접근 토큰 필요',exact=True).count():
            startup=(Path.home()/'data/geoaidesk/work/review-app/launcher.log').read_text()
            link=re.findall(r'https?://[^\s]+[#?]kady-token=[^\s]+',startup)[-1]
            page.get_by_role('textbox').fill(link);page.get_by_role('button',name='계속',exact=True).click()
            del startup,link
            page.wait_for_timeout(500)
        project=page.get_by_role('button',name='Yilgarn 니켈 광상 부존 가능성 프로젝트 열기',exact=True)
        if project.count():project.click();page.wait_for_timeout(700)
        page.get_by_role('button',name='대화 기록',exact=True).click();page.wait_for_timeout(300)
        page.get_by_role('menuitem').filter(has_text='Workflow · PU-컨포멀').click();page.wait_for_timeout(500)
        if page.get_by_role('button',name='파일 목록 표시',exact=True).count():
            page.get_by_role('button',name='파일 목록 표시',exact=True).click()
        tree=page.get_by_role('tree')
        if not tree.get_by_text('yilgarn_priority_map.png',exact=True).count():
            tree.get_by_text('outputs',exact=True).click();page.wait_for_timeout(200)
        tree.get_by_text('yilgarn_priority_map.png',exact=True).click();page.wait_for_timeout(500)
        page.get_by_role('button',name='파일 목록 숨기기',exact=True).click();page.wait_for_timeout(300)
        page.get_by_role('button',name=re.compile('^모델 선택')).click();page.wait_for_timeout(250)
        page.locator('[role=option][aria-disabled=false]').filter(has=page.get_by_text('GPT-6.1 Sol',exact=True)).click()
        page.evaluate(STAGE)
        card=page.locator('[data-workflow-block]:visible > button').first
        card.evaluate("e=>{for(let p=e.parentElement;p;p=p.parentElement){if(p.scrollHeight>p.clientHeight+10&&getComputedStyle(p).overflowY==='auto'){p.scrollTop=0;return}}}")
        page.wait_for_timeout(400)
        take=StudyTake(page,OUT,'R2-neutral-text',print)
        cardrect=rect_of(card);take.hold(45);take.move(card,15)
        chat=page.locator('[role=log]:visible').first
        chat.evaluate("e=>{for(const p of [e,...e.querySelectorAll('*')])if(p.scrollHeight>p.clientHeight+10&&getComputedStyle(p).overflowY==='auto')p.scrollTop=p.scrollHeight}")
        receipt=WORK/'r2-neutral-request.json'
        assert not receipt.exists(),'Citation request was already sent; inspect its state before retrying.'
        page.locator('textarea:visible').fill('서재 논문 인용을 확인해 주세요. 한 문장으로 알려 주세요.')
        page.get_by_role('button',name='요청 보내기',exact=True).click()
        receipt.write_text(json.dumps({'sent':True,'time':time.time(),'request':'서재 논문 인용을 확인해 주세요. 한 문장으로 알려 주세요.'},ensure_ascii=False)+'\n')
        started=time.monotonic()
        stop=page.get_by_role('button',name='실행 중단',exact=True)
        stop.wait_for(state='visible',timeout=10000)
        # Wait briefly for actual tool steps, without running a second request.
        page.wait_for_timeout(1800)
        page.evaluate(STAGE)
        assert stop.is_visible(),'Run finished before active-work capture; inspect rather than fabricate activity.'
        chatrect=rect_of(chat)
        work_wait=round(time.monotonic()-started,2)
        take.hold(60)
        page.screenshot(path=str(WORK/'R2-neutral-working.png'))
        take.hold(60)
        figure=page.get_by_role('img',name='yilgarn_priority_map.png',exact=True)
        figurerect=rect_of(figure)
        archive=WORK/'R2-before-neutral-text';assert not archive.exists()
        shutil.move(str(OUT/'shots/R2'),str(archive));shutil.move(str(take.dir),str(OUT/'shots/R2'))
        take.sid='R2';take.dir=OUT/'shots/R2'
        take.cuts=[{'t':2,'omitted_wall_s':work_wait,'after':'Cut to real citation work; capture-only text staging'}, {'t':4,'omitted_wall_s':0,'after':'Hold finished result figure'}]
        take.finish([{'t0':0,'t1':2,'label':'Workflow 지침으로 시작','rect':cardrect,'element':'Rendered Workflow card'},
            {'t0':2,'t1':4,'label':'AI agent가 작업 중','rect':chatrect,'element':'Visible live chat viewport'},
            {'t0':4,'t1':6,'label':'분석 결과를 바로 확인','rect':figurerect,'element':'Finished result map image'}])
        (WORK/'R2-neutral-text-evidence.json').write_text(json.dumps({'pageErrors':errors,'captureOnlyDOM':True,'recordTextChanged':False,'requestReceipt':str(receipt)},ensure_ascii=False,indent=2)+'\n')
        print('R2 neutral-text retake finished',cardrect,chatrect,figurerect)
        browser.close()

if __name__=='__main__':main()

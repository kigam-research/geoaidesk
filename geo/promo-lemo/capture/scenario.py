"""Observed UI staging for the installed Pocheon example; never auto-sends a run.

Import into live.py's command namespace. Calling stage_setup only prepares the
start summary. Starting real model work remains an explicit capture command.
"""

async def stage_setup(page):
    await page.get_by_role('button',name='Workflow',exact=True).first.click()
    await page.get_by_text('포천 자철석 광체 추정',exact=True).last.click()
    d=page.get_by_role('dialog')
    await d.get_by_role('tab',name='자료 준비와 전처리').click()
    await d.get_by_role('radio',name='직접 입력',exact=True).click()
    await d.get_by_role('textbox',name='분석 구역과 입력 해석',exact=True).fill(
        '예제 실습: 시추공 범위 +300 m ROI, EPSG:5186, 제공 DEM 기준. 기준국 공백과 입력 오차를 기록. 참조 광체는 평가 전까지 열지 않음.')
    await d.get_by_text('기본값이 있는 조건 2개',exact=True).click()
    await d.get_by_role('textbox',name='수치 설정과 논문 기준값',exact=True).fill(
        '제한 반복 실습: 50×50×25 m 셀, 50 m 관측 집계, 모델당 외부6회·CG20·tol1e-2, CPU4 threads, 계산합계600초 상한. 새 실행 pgi_live_retake/에 전처리부터 계산. 기존 결과 덮어쓰기 금지. 기존 호환 수정 코드는 재사용 가능.')
    await d.get_by_role('tab',name='물성과 지질 제약 PGI').click()
    await d.get_by_role('radio',name='단일 class 셀은 고정하고 충돌 셀은 미제약',exact=True).click()
    await d.get_by_role('tab',name='평가와 광체 해석').click()
    await d.get_by_role('radio',name='직접 입력',exact=True).nth(0).click()
    await d.get_by_role('textbox',name='저감도 제외 경계',exact=True).fill(
        '정규화 민감도0.05 미만 제외; 제외 전후 모두 평가. 참조 광체를 보기 전에 마스크 고정.')
    await d.get_by_role('radio',name='직접 입력',exact=True).nth(1).click()
    await d.get_by_role('textbox',name='해석할 연결 광체',exact=True).fill(
        'ROI 내부 연결 광체를 모두 보고하고 최대 연결 성분도 별도 표시. 참조 광체로 선택·임계값·GMM을 조정하지 않음.')
    await d.get_by_role('button',name='요약 보기',exact=True).click()
    # Place the actual summary at its top; the persistent footer action stays visible.
    await d.get_by_text('입력 자료',exact=True).scroll_into_view_if_needed()
    return d

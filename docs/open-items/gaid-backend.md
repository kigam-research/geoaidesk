# Open items from gaid-backend

Recorded: 2026-10-22. Close or answer an item from the project hub with `task item close|answer <id>`; closed items move to docs/open-items/closed/gaid-backend.md.

- [결정 gaid-backend#1] 연구자가 쓰는 시험 운영 시작 — 가) PC74에서 허브 서버를 병합한 판으로 고정 서비스로 띄우고, 사용자 관리자 계정 초대 코드를 드린 뒤, 검토용 허브의 Workflow 5건을 사용자가 정한 작성자 연결로 옮김 — 나) 기관 서버나 다른 원내 PC가 정해질 때까지 대기 — 권장: 가) 기능 시험은 끝났고 실제 연구자 사용으로 알림·부하·운영 문제를 알 수 있음 — 막힌 일: 연구자 시험 운영 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일 — 답함 2026-10-22: 가) PC74 고정 서비스·관리자 초대 코드·Workflow 5건 이전; "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자." (사용자, 2026-10-22) (후속: gaid-hub-server-trial)
- [부채 gaid-backend#2] 원내 HTTP로 비밀번호·로그인 열쇠·Workflow·서재 PDF가 암호화 없이 원내망을 지남(사용자 결정 4 나) — 가) 시험 그룹보다 넓히기 전에 HTTPS(리버스 프록시 또는 인증서) 적용 — 나) 유지 — 권장: 가) 자료 변경 없이 설정으로 바꿀 수 있음 — 막힌 일: 시험 그룹 밖 사용 — 근거: reports/2026-10-22-gaid-backend#5-한계 — 답함 2026-10-22: 가) 시험 그룹보다 넓히기 전에 HTTPS 적용; "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자." (사용자, 2026-10-22) (후속: gaid-hub-server-trial)
- [부채 gaid-backend#3] 허브 스킬 서랍(gaid-hub-skills)은 허브 서버에 로그인해도 각 PC의 로컬 허브 저장소에 남음(허브 서버 /hub/v1에 스킬 기록 없음) — 가) 허브 스킬 기록을 HubRecordStore와 같은 방식으로 허브 서버에 옮기는 후속 작업 — 나) 시험 운영 동안 PC별로 둠 — 권장: 가) 공유 서랍의 뜻이 원내 공유이므로 — 막힌 일: 여러 연구자 사이 허브 스킬 공유 — 근거: docs/adr/2026-10-22-gaid-hub-server.md

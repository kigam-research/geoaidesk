# GAID Connect / Workspace copy changes

Baseline: `9b7952ae`. Locale ids, namespace names, code identifiers, server routes and stored data are unchanged.

## Scope and rules

- 147 locale ids changed. Every row includes both locales, including an unchanged translation where only one locale needed the rename.
- `places` and `devPlaces` belong to the parent. Only the pre-existing `library.tabs.label` and `library.detail.usesTitle` keys were changed in the library namespace.
- External skill_hub copy is unchanged, including `skillHub.methodsEmpty` and every external-hub handoff string. Ordinary Office/connector workspace wording is unchanged.
- Rules: L2, N1, N5, D6, W1–W4. The Workflow-panel import action is shortened to `Connect에서 가져오기` / `Import from Connect`; the Workflow panel provides the object. Version-install and busy handoff actions are also shortened to W1 limits. No layout changes or screenshot requirement (UI guide §0.3).
- User decision recorded verbatim in the accepted ADR: "모두 권장대로 하자.". Version numbering/meaning and scientific-limit wording stay unchanged.

## Locale inventory

| String id | Korean before → after | English before → after |
|---|---|---|
| `app.projects.choose_a_project` | 내 연구 → GAID Workspace | My research → GAID Workspace |
| `app.projects.each_project_keeps_its_files_chats_notebook` | 프로젝트마다 파일, 대화, 연구 노트, 연구 설정을 따로 보관합니다. GAID 허브의 Workflow를 가져와 내 자료로 연구합니다. → 프로젝트마다 파일, 대화, 연구 노트, 연구 설정을 따로 보관합니다. GAID Connect의 Workflow를 가져와 내 자료로 연구합니다. | Each project keeps its files, chats, notebook and research settings. Bring analysis Workflows from the GAID hub and research with your data. → Each project keeps its files, chats, notebook and research settings. Bring analysis Workflows from GAID Connect and research with your data. |
| `app.settings.workspace` | 작업 환경 → 작업 환경 | Workspace → App |
| `authoringPreview.nav.workspace` | 연구 공간 → Workspace | Research workspace → Workspace |
| `authoringPreview.breadcrumb` | 연구 공간 / 새 Workflow → Workspace / 새 Workflow | Research workspace / New research Workflow → Workspace / New research Workflow |
| `hub.nav.projects` | 내 연구 → Workspace | My research → Workspace |
| `hub.nav.hub` | GAID 허브 → Connect | GAID hub → Connect |
| `hub.sidebar.hide` | 허브 목록 숨기기 → Connect 목록 숨기기 | Hide hub sections → Hide Connect sections |
| `hub.sidebar.show` | 허브 목록 표시 → Connect 목록 표시 | Show hub sections → Show Connect sections |
| `hub.entry.title` | GAID 허브 → GAID Connect | GAID hub → GAID Connect |
| `hub.entry.body` | 연구자들이 등록한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. → 연구자들이 공유한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. | Use analysis Workflows other researchers registered with your own data, or make a new Workflow from your paper or code. → Use analysis Workflows other researchers shared with your own data, or make a new Workflow from your paper or code. |
| `hub.entry.open` | GAID 허브 열기 → Connect 열기 | Open GAID hub → Open Connect |
| `hub.home.title` | GAID 허브 → GAID Connect | GAID hub → GAID Connect |
| `hub.home.body` | 연구자들이 등록한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. → 연구자들이 공유한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. | Use analysis Workflows other researchers registered with your own data, or make a new Workflow from your paper or code. → Use analysis Workflows other researchers shared with your own data, or make a new Workflow from your paper or code. |
| `hub.home.back` | 허브 목록 → Connect 목록 | Hub list → Connect list |
| `hub.home.mine` | 내가 만든 Workflow (초안과 등록한 것) → 내가 만든 Workflow (초안과 공유한 것) | Workflows I made (drafts and registered) → Workflows I made (drafts and shared) |
| `hub.home.registered` | 허브 등록 version {version} → 공유됨 · version {version} | Hub registration version {version} → Shared · version {version} |
| `hub.home.catalogueHint` | {title}: 카탈로그 Workflow입니다. 내 연구 프로젝트의 Workflow 패널에서 시작합니다. → {title}: 카탈로그 Workflow입니다. Workspace 프로젝트의 Workflow 패널에서 시작합니다. | {title} is a catalogue Workflow. Start it from the Workflow panel of a research project. → {title} is a catalogue Workflow. Start it from a Workspace project’s Workflow panel. |
| `hub.home.browse.title` | 허브에 등록된 Workflow → 공유된 Workflow | Workflows registered in the hub → Shared Workflows |
| `hub.home.browse.folders` | 등록 Workflow 주제 폴더 → 공유된 Workflow 주제 폴더 | Registered Workflow topic folders → Shared Workflow topic folders |
| `hub.home.browse.search.label` | 등록 Workflow 검색 → 공유된 Workflow 검색 | Search registered Workflows → Search shared Workflows |
| `hub.home.browse.order` | star 많은 순 · 최근 등록순 → star 많은 순 · 최근 공유순 | Most stars · Newest registration → Most stars · Recently shared |
| `hub.home.browse.loading` | 등록 Workflow를 읽는 중입니다. → 공유된 Workflow를 읽는 중입니다. | Reading registered Workflows. → Reading shared Workflows. |
| `hub.home.browse.error` | 등록 Workflow를 읽지 못했습니다. 목록을 다시 읽으세요. → 공유된 Workflow를 읽지 못했습니다. 목록을 다시 읽으세요. | Could not read registered Workflows. Reload the list. → Could not read shared Workflows. Reload the list. |
| `hub.home.browse.empty` | 등록된 Workflow가 없습니다. 추천 Workflow를 살펴보세요. → 공유된 Workflow가 없습니다. 추천 Workflow를 살펴보세요. | No Workflows are registered. Browse the recommended analysis Workflows. → No Workflows are shared. Browse the recommended analysis Workflows. |
| `hub.home.route.use.title` | 등록된 Workflow 쓰기 → 공유된 Workflow 쓰기 | Use a registered Workflow → Use a shared Workflow |
| `hub.home.glossary.title` | 허브에서 쓰는 말 → Connect에서 쓰는 말 | Words used in the hub → Words used in Connect |
| `hub.home.glossary.draft.text` | 아직 허브에 등록하지 않은 Workflow입니다. 다른 연구자의 허브 목록에는 나오지 않습니다. → 아직 Connect에 공유하지 않은 Workflow입니다. 다른 연구자의 Connect 목록에는 나오지 않습니다. | A Workflow not yet registered in the hub. It does not appear in other researchers' hub lists. → A Workflow not yet shared on Connect. It does not appear in other researchers’ Connect lists. |
| `hub.home.glossary.revision.text` | 등록한 Workflow의 version입니다. 0.1.0으로 시작하며, 갱신할 때 등록자가 patch·minor·major를 고릅니다. 1.0.0은 메인 배포입니다. → 공유한 Workflow의 version입니다. 0.1.0으로 시작하며, 갱신할 때 공유한 연구자가 patch·minor·major를 고릅니다. 1.0.0은 메인 배포입니다. | A registered Workflow starts at version 0.1.0. For updates, its registrant chooses patch, minor or major. Version 1.0.0 is the main release. → A shared Workflow starts at version 0.1.0. For updates, the researcher who shared it chooses patch, minor or major. Version 1.0.0 is the main release. |
| `hub.home.nav` | 허브 목록 → Connect 목록 | Hub sections → Connect sections |
| `hub.home.mineItem` | 초안과 등록한 것 → 초안과 공유한 것 | Drafts and registered → Drafts and shared |
| `hub.stage.package` | 시험·등록 준비됨 → 시험·공유 준비됨 | Ready to try and register → Ready to try and share |
| `hub.stage.registered` | 허브에 등록됨 → 공유됨 | Registered in the hub → Shared |
| `hub.steps.publish` | 허브 등록 → Connect에 공유 | Register in hub → Share on Connect |
| `hub.steps.trialOptional` | 내 연구에서 시험 (선택) → Workspace에서 시험 (선택) | Try in my research (optional) → Try in Workspace (optional) |
| `hub.reading.note` | 화면을 닫아도 계속 읽습니다. 허브 첫 화면의 '내가 만든 Workflow'에서 다시 열 수 있습니다. 논문이 길면 몇 분 넘게 걸립니다. → 화면을 닫아도 계속 읽습니다. Connect 첫 화면의 '내가 만든 Workflow'에서 다시 열 수 있습니다. 논문이 길면 몇 분 넘게 걸립니다. | Reading continues if you close this screen. Reopen it from 'Workflows I made' on the hub home. A long paper takes several minutes or more. → Reading continues if you close this screen. Reopen it from 'Workflows I made' on Connect home. A long paper takes several minutes or more. |
| `hub.trial.title` | 내 연구 프로젝트에서 먼저 시험 (선택) → 프로젝트에서 먼저 시험 (선택) | Try in my research project first (optional) → Try in a project first (optional) |
| `hub.register.open` | 허브 등록 미리보기 → 공유 미리보기 | Preview hub page → Preview sharing |
| `hub.register.update` | 허브 등록 갱신 → 공유 내용 갱신 | Update hub entry → Update shared Workflow |
| `hub.register.title` | GAID 허브에 등록 → Connect에 공유 | Register in the GAID hub → Share on Connect |
| `hub.register.folder` | 허브 공개 분류 (폴더) → Connect 공개 분류 (폴더) | Hub category (folder) → Connect category (folder) |
| `hub.register.submit` | 허브에 등록 → Connect에 공유 | Register in hub → Share on Connect |
| `hub.register.line` | 허브에 등록하면 다른 연구자가 보고 star와 의견을 남길 수 있습니다. 등록 전 모습을 먼저 확인하세요. → Connect에 공유하면 다른 연구자가 보고 star와 의견을 남길 수 있습니다. 공유 전 모습을 먼저 확인하세요. | Registered Workflows can be viewed, starred and discussed by other researchers. Check how it will look first. → Shared Workflows can be viewed, starred and discussed by other researchers. Check how it will look first. |
| `hub.register.registeredLine` | version {version}이 허브에 등록되어 있습니다. → version {version}이 Connect에 공유되어 있습니다. | Version {version} is registered in the hub. → Version {version} is shared on Connect. |
| `hub.register.previewBanner` | 미리보기: 허브에 등록하면 다른 연구자에게 이렇게 보입니다. → 미리보기: Connect에 공유하면 다른 연구자에게 이렇게 보입니다. | Preview: this is how other researchers will see it in the hub. → Preview: this is how other researchers will see it in Connect. |
| `hub.register.notYet` | 허브 공유 저장소는 화면 협의 후 연결합니다. 지금은 미리보기만 됩니다. → Connect 공유 저장소는 화면 협의 후 연결합니다. 지금은 미리보기만 됩니다. | The shared hub store is connected after the screens are agreed. Preview only for now. → The shared Connect store is connected after the screens are agreed. Preview only for now. |
| `hub.register.before` | 등록 전 → 공유 전 | not registered → not shared |
| `hub.register.firstVersion` | 처음 등록하면 version {version}이 됩니다. → 처음 공유하면 version {version}이 됩니다. | The first registration will be version {version}. → The first shared version will be {version}. |
| `hub.register.versionFailed` | 현재 version을 읽지 못했습니다. 등록창을 닫고 다시 여세요. → 현재 version을 읽지 못했습니다. 공유 창을 닫고 다시 여세요. | Could not read the current version. Close and reopen the registration dialog. → Could not read the current version. Close and reopen the sharing dialog. |
| `hub.register.examples.who` | 예제 자료 파일은 Workflow와 함께 허브에 올라갑니다. 허브에서 Workflow를 볼 수 있는 연구자는 누구나 내려받을 수 있습니다. → 예제 자료 파일은 Workflow와 함께 Connect에 올라갑니다. Connect에서 Workflow를 볼 수 있는 연구자는 누구나 내려받을 수 있습니다. | Example data files go to the hub with the Workflow. Every researcher who can see the Workflow in the hub can download them. → Example data files go to Connect with the Workflow. Every researcher who can see the Workflow in Connect can download them. |
| `hub.shared.trials` | 등록된 version으로 시작한 시험 {count}회 (검토 결과 아님) → 공유된 version으로 시작한 시험 {count}회 (검토 결과 아님) | {count, plural, one {# trial started with registered versions} other {# trials started with registered versions}} (not a review) → {count, plural, one {# trial started with shared versions} other {# trials started with shared versions}} (not a review) |
| `hub.shared.registeredAt` | {when} 등록 → {when} 공유 | registered {when} → shared {when} |
| `hub.shared.afterRegister` | 등록하면 다른 연구자가 star와 의견을 남길 수 있습니다. → 공유하면 다른 연구자가 star와 의견을 남길 수 있습니다. | After registration, other researchers can star it and comment. → After sharing, other researchers can star it and comment. |
| `hub.shared.back` | 허브 목록 → Connect 목록 | Hub list → Connect list |
| `hub.shared.edit.hint` | 다음 version은 등록할 때 고릅니다. 이전 version도 계속 설치할 수 있습니다. → 다음 version은 공유할 때 고릅니다. 이전 version도 계속 설치할 수 있습니다. | Choose the next version when registering. Earlier versions stay installable. → Choose the next version when sharing. Earlier versions stay installable. |
| `hub.shared.copy.hint` | 내 Workflow로 복사해 고칩니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. → 내 Workflow로 복사해 고칩니다. 공유하면 원본을 밝힌 별도 Workflow가 됩니다. | Copies the Workflow into your own Workflows. Registered, it becomes a separate Workflow that names the original. → Copies the Workflow into your own Workflows. Shared, it becomes a separate Workflow that names the original. |
| `hub.user.title` | 허브에서 쓸 이름 → Connect에서 쓸 이름 | Name in the hub → Name in Connect |
| `hub.user.body` | 만든 Workflow, 등록, star, 의견에 표시할 이름입니다. 브라우저에 저장합니다. → 만든 Workflow, 공유, star, 의견에 표시할 이름입니다. 브라우저에 저장합니다. | The name shown on Workflows you make, registrations, stars and comments. It is saved in this browser. → The name shown on Workflows you make, sharing, stars and comments. It is saved in this browser. |
| `hub.visuals.explanation` | Workflow를 설명하는 그림입니다. 분석 자료나 결과가 아니며, 초안과 허브 등록 화면에 표시됩니다. → Workflow를 설명하는 그림입니다. 분석 자료나 결과가 아니며, 초안과 Connect 공유 화면에 표시됩니다. | Illustrations of the Workflow, not analysis data or results. They appear in the draft and hub registration. → Illustrations of the Workflow, not analysis data or results. They appear in the draft and Connect sharing preview. |
| `hub.editing.edit` | 등록한 Workflow의 version {version}을 고치고 있습니다. 다음 version은 등록할 때 고릅니다. → 공유한 Workflow의 version {version}을 고치고 있습니다. 다음 version은 공유할 때 고릅니다. | You are editing version {version} of your registered Workflow. Choose its next version when registering. → You are editing version {version} of your shared Workflow. Choose its next version when sharing. |
| `hub.editing.copy` | {author}의 「{title}」 version {version}을 복사한 내 Workflow입니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. → {author}의 「{title}」 version {version}을 복사한 내 Workflow입니다. 공유하면 원본을 밝힌 별도 Workflow가 됩니다. | Your copy of version {version} of “{title}” by {author}. Registered, it becomes a separate Workflow that names the original. → Your copy of version {version} of “{title}” by {author}. Shared, it becomes a separate Workflow that names the original. |
| `hub.remove.action` | 허브에서 제거 → Connect에서 제거 | Remove from hub → Remove from Connect |
| `hub.remove.body` | 「{title}」을 허브 목록에서 제거합니다. 프로젝트에 이미 설치한 사본은 유지됩니다. → 「{title}」을 Connect 목록에서 제거합니다. 프로젝트에 이미 설치한 사본은 유지됩니다. | “{title}” will disappear from hub lists. Copies already installed in projects will stay. → “{title}” will disappear from Connect lists. Copies already installed in projects will stay. |
| `hub.remove.restoreLocal` | 기관 허브 서버를 쓰지 않는 경우, 등록자가 제거된 Workflow 목록에서 복원할 수 있습니다. → 기관 Connect 서버를 쓰지 않는 경우, 공유한 연구자가 제거된 Workflow 목록에서 복원할 수 있습니다. | Without an institute hub server, the registrant can restore it from the removed Workflows list. → Without an institute Connect server, the researcher who shared it can restore it from the removed Workflows list. |
| `hub.removed.body` | 복원하면 허브 목록에 다시 표시됩니다. 프로젝트의 설치본은 바뀌지 않습니다. → 복원하면 Connect 목록에 다시 표시됩니다. 프로젝트의 설치본은 바뀌지 않습니다. | Restoring returns a Workflow to hub lists. Copies installed in projects do not change. → Restoring returns a Workflow to Connect lists. Copies installed in projects do not change. |
| `hub.removed.empty` | 복원할 Workflow가 없습니다. 허브 목록에서 Workflow를 살펴보세요. → 복원할 Workflow가 없습니다. Connect 목록에서 Workflow를 살펴보세요. | No Workflows to restore. Browse the hub list. → No Workflows to restore. Browse Connect list. |
| `hub.removed.restored` | 「{title}」을 허브 목록에 복원했습니다. → 「{title}」을 Connect 목록에 복원했습니다. | “{title}” is back in hub lists. → “{title}” is back in Connect lists. |
| `hub.example.removeAsk` | 새 초안에서 예제 자료를 뺍니다. 이전 초안과 등록한 version에는 남습니다. → 새 초안에서 예제 자료를 뺍니다. 이전 초안과 공유한 version에는 남습니다. | The new draft drops this example data. Earlier drafts and registered versions keep it. → The new draft drops this example data. Earlier drafts and shared versions keep it. |
| `hub.stages.reviewNote` | AI agent가 새 초안을 만듭니다. 바뀐 단계와 조건을 검토한 뒤 시험하거나 등록하세요. → AI agent가 새 초안을 만듭니다. 바뀐 단계와 조건을 검토한 뒤 시험하거나 공유하세요. | The AI agent writes a new draft. Review the changed stages and conditions before you try or register it. → The AI agent writes a new draft. Review the changed stages and conditions before you try or share it. |
| `hubFeeds.emptyAll` | 승인한 출처에서 아직 모은 항목이 없습니다. 관리자가 출처를 승인하면 허브 서버가 주기적으로 모읍니다. → 승인한 출처에서 아직 모은 항목이 없습니다. 관리자가 출처를 승인하면 기관 Connect 서버가 주기적으로 모읍니다. | Approved sources have no collected items yet. Once an administrator approves sources, the hub server collects them on a schedule. → Approved sources have no collected items yet. Once an administrator approves sources, the institute Connect server collects them on a schedule. |
| `hubFeeds.offline.title` | 기관 GAID 허브에 로그인하면 자료 소식이 보입니다 → 기관 Connect 서버 로그인 필요 | Log in to the institute GAID hub to see research feeds → Log in to the institute Connect server |
| `hubFeeds.offline.body` | 관리자가 승인한 출처의 소식은 기관 허브 서버가 모읍니다. 설정 → 서비스 → 기관 GAID 허브에서 서버에 로그인하세요. → 관리자가 승인한 출처의 소식은 기관 Connect 서버가 모읍니다. 설정 → 서비스 → 기관 Connect 서버에서 서버에 로그인하세요. | The institute hub server collects the sources an administrator approved. Log in under Settings → Services → Institute GAID hub. → The institute Connect server collects the sources an administrator approved. Log in under Settings → Services → Institute Connect server. |
| `hubFeeds.offline.button` | 허브 서버 설정 열기 → 기관 서버 설정 열기 | Open hub server settings → Open institute server settings |
| `hubFeeds.admin.intro` | 승인한 출처만 허브 서버가 {hours}시간마다 읽습니다. 원문 제목, 피드 요약, 링크만 저장합니다. → 승인한 출처만 기관 Connect 서버가 {hours}시간마다 읽습니다. 원문 제목, 피드 요약, 링크만 저장합니다. | The hub server reads approved sources only, every {hours} hours. It stores the original title, the feed summary and the link. → The institute Connect server reads approved sources only, every {hours} hours. It stores the original title, the feed summary and the link. |
| `hubHandoff.open` | 방금 한 분석을 GAID 허브 초안으로 보내기 → 방금 한 분석을 Connect 초안으로 보내기 | Send the analysis just done to a GAID hub draft → Send the analysis just done to a Connect draft |
| `hubHandoff.openLabel` | 허브 초안으로 보내기 → Connect 초안으로 보내기 | Send to hub draft → Send to Connect draft |
| `hubHandoff.title` | 허브 초안으로 보낼 분석 → Connect 초안으로 보낼 분석 | Analysis for a hub draft → Analysis for a Connect draft |
| `hubHandoff.description` | 요청과 마지막 답변, 선택한 파일을 묶어 GAID 허브의 새 Workflow 초안 자료로 보냅니다. → 요청과 마지막 답변, 선택한 파일을 묶어 GAID Connect의 새 Workflow 초안 자료로 보냅니다. | Bundle the request, final answer and selected files and send them to the GAID hub as material for a new Workflow draft. → Bundle the request, final answer and selected files and send them to GAID Connect as material for a new Workflow draft. |
| `hubHandoff.path.hub` | GAID 허브에 새 초안을 만들고 분석 묶음을 자료로 붙였습니다. → GAID Connect에 새 초안을 만들고 분석 묶음을 자료로 붙였습니다. | Created a new GAID hub draft with the analysis bundle as its material. → Created a new GAID Connect draft with the analysis bundle as its material. |
| `hubHandoff.sendHub` | 허브 초안으로 보내기 → Connect 초안으로 보내기 | Send to hub draft → Send to Connect draft |
| `hubHandoff.sendingHub` | 허브 초안을 만드는 중입니다. → 초안 만드는 중 | Creating the hub draft. → Creating draft |
| `hubHandoff.openHubDraft` | 허브 초안 열기 → Connect 초안 열기 | Open hub draft → Open Connect draft |
| `hubHandoff.extrasHelp` | GAID 허브로 보낼 때만 넣습니다. 현재 채팅이 쓴 연구 노트와 프로젝트에 연결한 서재 논문을 미리 골랐습니다. 각각 {limit}개까지입니다. → Connect로 보낼 때만 넣습니다. 현재 채팅이 쓴 연구 노트와 프로젝트에 연결한 서재 논문을 미리 골랐습니다. 각각 {limit}개까지입니다. | Included only when sending to the GAID hub. The research notes this chat wrote and the library papers attached to the project are preselected. Up to {limit} of each. → Included only when sending to Connect. The research notes this chat wrote and the library papers attached to the project are preselected. Up to {limit} of each. |
| `hubPicker.search.label` | GAID 허브 검색 → GAID Connect 검색 | Search GAID hub → Search GAID Connect |
| `hubPicker.loading` | 허브 목록을 읽는 중입니다. → Connect 목록을 읽는 중입니다. | Reading hub entries. → Reading Connect entries. |
| `hubPicker.error` | 허브 목록을 읽지 못했습니다. 다시 읽으세요. → Connect 목록을 읽지 못했습니다. 다시 읽으세요. | Could not read hub entries. Reload the list. → Could not read Connect entries. Reload the list. |
| `hubPicker.results` | 허브 검색 결과 → Connect 검색 결과 | Hub search results → Connect search results |
| `hubPicker.kindTip` | 허브에 등록된 Workflow의 유형입니다. → Connect에 공유된 Workflow의 유형입니다. | The type of Workflow registered in the hub. → The type of Workflow shared on Connect. |
| `hubPicker.browse.button` | GAID 허브에서 찾기 → Connect에서 찾기 | Find in GAID hub → Find in Connect |
| `hubPicker.description` | GAID 허브에서 Workflow를 찾거나 저장한 시작 설정 파일을 가져옵니다. → GAID Connect에서 Workflow를 찾거나 저장한 시작 설정 파일을 가져옵니다. | Find a Workflow in the GAID hub or import a saved start settings file. → Find a Workflow in GAID Connect or import a saved start settings file. |
| `hubPicker.installError` | Workflow를 설치하지 못했습니다. 허브에서 선택한 version을 확인한 뒤 다시 시도하세요. → Workflow를 설치하지 못했습니다. Connect에서 선택한 version을 확인한 뒤 다시 시도하세요. | Could not install the Workflow. Check the selected version in the hub and try again. → Could not install the Workflow. Check the selected version in Connect and try again. |
| `hubPicker.skillTitle` | GAID 허브에서 스킬 찾기 → Connect에서 스킬 찾기 | Find skills in GAID hub → Find skills in Connect |
| `hubPicker.previewSource` | GAID 허브 · {title} · version {version} → GAID Connect · {title} · version {version} | GAID hub · {title} · version {version} → GAID Connect · {title} · version {version} |
| `hubServer.title` | 기관 GAID 허브 → 기관 Connect 서버 | Institute GAID hub → Institute Connect server |
| `hubServer.https` | 기관 GAID 허브에 HTTPS로 연결합니다. → 기관 Connect 서버에 HTTPS로 연결합니다. | Connects to the institute GAID hub over HTTPS. → Connects to the institute Connect server over HTTPS. |
| `hubServer.notConfigured` | 기관 허브를 연결하지 않았습니다. → 기관 Connect 서버를 연결하지 않았습니다. | No institute hub is connected. → No institute Connect server is connected. |
| `hubServer.reachable` | 기관 허브에 연결했습니다. → 기관 Connect 서버에 연결했습니다. | Connected to the institute hub. → Connected to the institute Connect server. |
| `hubServer.unreachable` | 기관 허브에 연결하지 못했습니다. → 기관 Connect 서버에 연결하지 못했습니다. | Could not connect to the institute hub. → Could not connect to the institute Connect server. |
| `hubServer.address` | 허브 서버 주소 → 기관 Connect 서버 주소 | Hub server address → Institute Connect server address |
| `hubServer.connect.button` | 허브 연결 → 서버 연결 | Connect hub → Connect server |
| `hubServer.disconnect.button` | 연결 끊기 → 연결 끊기 | Disconnect hub → Disconnect server |
| `hubServer.auth.title` | 허브 계정 연결 → Connect 계정 연결 | Hub account connection → Connect account connection |
| `hubServer.admin.title` | 허브 서버 관리 → 기관 Connect 서버 관리 | Hub server administration → Institute Connect server administration |
| `hubServer.sync.title` | 기관 허브와 서재 동기화 → 기관 서버와 서재 동기화 | Library sync with institute hub → Library sync with institute server |
| `hubServer.identity.failed` | 허브 계정을 확인하지 못했습니다. 연결 설정을 확인하세요. → Connect 계정을 확인하지 못했습니다. 연결 설정을 확인하세요. | Could not check the hub account. Check the connection settings. → Could not check the Connect account. Check the connection settings. |
| `hubSkills.title` | 허브 스킬 → Connect 스킬 | Hub skills → Connect skills |
| `hubSkills.search` | 허브 스킬 검색 → Connect 스킬 검색 | Search hub skills → Search Connect skills |
| `hubSkills.emptyAll` | 허브에 올린 스킬이 아직 없습니다. → Connect에 올린 스킬이 아직 없습니다. | No skills have been added to the hub yet. → No skills have been added to Connect yet. |
| `hubSkills.unused` | 등록된 Workflow에서 아직 쓰지 않습니다. → 공유된 Workflow에서 아직 쓰지 않습니다. | No registered Workflow uses this yet. → No shared Workflow uses this yet. |
| `hubSkills.steps.register` | 등록 내용 → 공유 내용 | Registration → Sharing |
| `hubSkills.stepsLabel` | 스킬 등록 단계 → 스킬 공유 단계 | Skill registration steps → Skill sharing steps |
| `hubSkills.source.workflow` | 허브 Workflow에서 꺼내기 → Connect Workflow에서 꺼내기 | Take from a hub Workflow → Take from a Connect Workflow |
| `hubSkills.workflow` | 허브 Workflow → Connect Workflow | Hub Workflow → Connect Workflow |
| `hubSkills.settingsSource` | GAID 허브에서 → GAID Connect에서 | From GAID hub → From GAID Connect |
| `hubSkills.installedRevision` | 허브 스킬 · version {revision} → Connect 스킬 · version {revision} | Hub skill · version {revision} → Connect skill · version {revision} |
| `hubSkills.projectOnly` | 허브 스킬은 프로젝트에 설치합니다. 적용 범위를 프로젝트로 바꾸세요. → Connect 스킬은 프로젝트에 설치합니다. 적용 범위를 프로젝트로 바꾸세요. | Hub skills install into a project. Change the scope to project. → Connect skills install into a project. Change the scope to project. |
| `library.tabs.label` | 내 연구 화면 → 서재 화면 | My research views → Library views |
| `library.detail.usesTitle` | 내 연구에서 쓰인 곳 → 쓰인 곳 | Used in your research → Used in |
| `methods.category` | 허브에서 설치한 Workflow → Connect에서 설치한 Workflow | Workflows installed from the hub → Workflows installed from Connect |
| `methods.empty` | 허브에서 설치한 Workflow가 없습니다. GAID 허브에서 Workflow를 골라 설치하세요. → Connect에서 설치한 Workflow가 없습니다. GAID Connect에서 Workflow를 골라 설치하세요. | No hub Workflows installed. Choose and install a Workflow from the GAID hub. → No Connect Workflows installed. Choose and install a Workflow from GAID Connect. |
| `methods.questions` | 허브에서 미해결인 질문 → Connect에서 미해결인 질문 | Questions unresolved in the hub → Questions unresolved in Connect |
| `methods.page` | 허브 페이지 보기 → Connect 페이지 보기 | View hub page → View Connect page |
| `methods.origin.gaid-hub` | GAID 허브 → GAID Connect | GAID hub → GAID Connect |
| `methods.badge.stage` | {stage, select, draft {허브 초안} submitted {허브 제출됨} published {허브 공개됨} other {허브 단계 미확인}} → {stage, select, draft {Connect 초안} submitted {Connect 제출됨} published {Connect 공개됨} other {Connect 단계 미확인}} | {stage, select, draft {Hub draft} submitted {Hub submitted} published {Hub published} other {Hub stage unknown}} → {stage, select, draft {Connect draft} submitted {Connect submitted} published {Connect published} other {Connect stage unknown}} |
| `methods.badge.stageTip` | 허브에 기록된 Workflow 파일 묶음의 단계입니다. 현재 프로젝트의 준비·시험 상태와 별개입니다. → Connect에 기록된 Workflow 파일 묶음의 단계입니다. 현재 프로젝트의 준비·시험 상태와 별개입니다. | The stage the hub records for this Workflow. Separate from this project's preparation and trials. → The stage Connect records for this Workflow. Separate from this project's preparation and trials. |
| `methods.registered` | 등록됨 · version {version} → 공유됨 · version {version} | Registered · version {version} → Shared · version {version} |
| `methods.checks.passed` | 허브 검사를 통과했습니다 · {at} → Connect 검사를 통과했습니다 · {at} | Passed the hub check · {at} → Passed Connect check · {at} |
| `methods.checks.notes` | 허브 검사를 통과했습니다 · {at} · 참고 사항 {count}개 → Connect 검사를 통과했습니다 · {at} · 참고 사항 {count}개 | Passed the hub check · {at} · {count, plural, one {# note} other {# notes}} → Passed Connect check · {at} · {count, plural, one {# note} other {# notes}} |
| `methods.checks.plain.draft-note` | GAID 허브가 초안을 고친 부분이 있습니다. → GAID Connect가 초안을 고친 부분이 있습니다. | The GAID hub corrected parts of the draft. → GAID Connect corrected parts of the draft. |
| `noteExport.readme.draft` | 초안 (등록된 version 없음) → 초안 (공유된 version 없음) | Draft (no registered version) → Draft (no shared version) |
| `notes.detail.methodUnnamed` | 허브 방법 → Connect 방법 | hub method → Connect method |
| `orcid.auth.noAccount` | ORCID 본인 확인에는 기관 GAID 허브 로그인이 필요합니다. → ORCID 본인 확인에는 기관 Connect 서버 로그인이 필요합니다. | To verify your ORCID iD, log in to the institute GAID hub. → To verify your ORCID iD, log in to the institute Connect server. |
| `orcid.auth.settings.button` | 기관 허브 설정 열기 → 기관 서버 설정 열기 | Open institute hub settings → Open institute server settings |
| `orcid.auth.notConfigured` | 허브에 ORCID 연결이 설정되지 않았습니다. 허브 관리자에게 문의하세요. → 기관 Connect 서버에 ORCID 연결이 설정되지 않았습니다. 서버 관리자에게 문의하세요. | ORCID is not set up on this hub. Ask the hub administrator. → ORCID is not set up on this institute Connect server. Ask the server administrator. |
| `orcid.auth.unreachable` | 기관 GAID 허브에 연결하지 못했습니다. 연결 상태를 다시 읽으세요. → 기관 Connect 서버에 연결하지 못했습니다. 연결 상태를 다시 읽으세요. | Could not reach the institute GAID hub. Read the connection status again. → Could not reach the institute Connect server. Read the connection status again. |
| `orcid.auth.unlink.hint` | 허브 계정의 본인 확인 연결을 해제합니다. iD는 인증 안 된 상태로 남고, 가져온 논문과 내 논문 표시는 유지합니다. → Connect 계정의 본인 확인 연결을 해제합니다. iD는 인증 안 된 상태로 남고, 가져온 논문과 내 논문 표시는 유지합니다. | Remove the verified link from your hub account. The iD stays as unauthenticated; imported works and own-work marks stay. → Remove the verified link from your Connect account. The iD stays as unauthenticated; imported works and own-work marks stay. |
| `skillHub.previewHubSkills` | Workflow가 쓰는 허브 스킬도 함께 설치합니다: {names} → Workflow가 쓰는 Connect 스킬도 함께 설치합니다: {names} | The hub skills this Workflow uses are installed with it: {names} → The Connect skills this Workflow uses are installed with it: {names} |
| `skillHub.previewHubBlocked` | 함께 설치하지 못하는 허브 스킬: {names}. 설치한 뒤 준비 확인에서 이유를 볼 수 있습니다. → 함께 설치하지 못하는 Connect 스킬: {names}. 설치한 뒤 준비 확인에서 이유를 볼 수 있습니다. | Hub skills that cannot be installed with it: {names}. After installing, readiness shows why. → Connect skills that cannot be installed with it: {names}. After installing, readiness shows why. |
| `workflowDoc.source.hub` | 허브 스킬 → Connect 스킬 | hub skill → Connect skill |
| `workflowView.source.hub` | 허브 스킬 → Connect 스킬 | hub skill → Connect skill |
| `workflowView.hubOpen` | 허브에서 보기 → Connect에서 보기 | Open in hub → Open in Connect |
| `workflowView.hubState.suspended` | 허브에서 사용 중지한 version입니다. Workflow 작성자에게 알려 주세요. → Connect에서 사용 중지한 version입니다. Workflow 작성자에게 알려 주세요. | This version is suspended in the hub. Tell the Workflow author. → This version is suspended in Connect. Tell the Workflow author. |
| `workspace.setup.noWorkspace` | 작업 공간을 찾지 못했습니다. 프로젝트 작업 공간에서 다시 여세요. 고른 값은 유지합니다. → 프로젝트를 찾지 못했습니다. 프로젝트에서 다시 여세요. 고른 값은 유지합니다. | No workspace found. Open it again from the project workspace. Your choices are kept. → No project found. Open it again from the project. Your choices are kept. |
| `workspace.recipe.import` | 허브에서 Workflow 가져오기 → Connect에서 가져오기 | Import Workflow from hub → Import from Connect |
| `workspace.skills.hub` | 허브 스킬 {name} (version {revision}): → Connect 스킬 {name} (version {revision}): | Hub skill {name} (version {revision}): → Connect skill {name} (version {revision}): |
| `workspace.skills.hubInstall` | 허브에서 version {revision} 설치하기 → version {revision} 설치 | Install version {revision} from the hub → Install version {revision} |
| `workspace.start.source.hub` | 허브 Workflow → Connect Workflow | Hub Workflow → Connect Workflow |

## Researcher-visible server copy

Parent authorized these extra files on 2026-10-24. The following source labels identify literals; they are documentation labels, not new locale ids. The standard authoring question has no separate English translation in the existing API.

| Source label | File | Korean before → after | English before → after |
|---|---|---|---|
| `server.authoring.hub-skills.question.text` | `server/src/geo/authoring/hub-skills.ts` | 허브에 있는 스킬 가운데 Workflow 단계에서 함께 쓸 것이 있나요? → Connect에 있는 스킬 가운데 Workflow 단계에서 함께 쓸 것이 있나요? | Not provided (Korean-only standard question; unchanged API) |
| `server.authoring.hub-skills.question.reason` | `server/src/geo/authoring/hub-skills.ts` | 허브 스킬을 고르면 그 스킬의 판을 고정해 단계에 연결하고, 같은 내용을 새로 쓰지 않습니다. → Connect 스킬을 고르면 그 스킬의 판을 고정해 단계에 연결하고, 같은 내용을 새로 쓰지 않습니다. | Not provided (Korean-only standard question; unchanged API) |
| `server.authoring.hub-skills.options.none.hint` | `server/src/geo/authoring/hub-skills.ts` | 허브 스킬 없이 Workflow에 딸린 스킬만 씁니다. → Connect 스킬 없이 Workflow에 딸린 스킬만 씁니다. | Not provided (Korean-only standard question; unchanged API) |
| `server.orcid.callback.no-account` | `server/src/geo/routes/orcid.ts` | 기관 GAID 허브에 로그인한 뒤 GAID 서재에서 다시 시작하세요. → 기관 Connect 서버에 로그인한 뒤 GAID 서재에서 다시 시작하세요. | Log in to the institute GAID hub, then start again from the GAID library. → Log in to the institute Connect server, then start again from the GAID library. |
| `server.orcid.callback.taken` | `server/src/geo/routes/orcid.ts` | 이 ORCID iD는 다른 허브 계정에 이미 연결되어 있습니다. 허브 관리자에게 문의하세요. → 이 ORCID iD는 다른 Connect 계정에 이미 연결되어 있습니다. 기관 서버 관리자에게 문의하세요. | This ORCID iD is already linked to another hub account. Ask the hub administrator. → This ORCID iD is already linked to another Connect account. Ask the institute server administrator. |
| `server.orcid.callback.not-configured` | `server/src/geo/routes/orcid.ts` | 기관 GAID 허브에 ORCID 연결이 설정되어 있지 않습니다. → 기관 Connect 서버에 ORCID 연결이 설정되어 있지 않습니다. | The institute GAID hub has no ORCID connection set up. → The institute Connect server has no ORCID connection set up. |
| `server.orcid.callback.unreachable` | `server/src/geo/routes/orcid.ts` | 허브 서버가 ORCID 확인을 마치지 못했습니다. 잠시 뒤 GAID 서재에서 다시 시작하세요. → 기관 Connect 서버가 ORCID 확인을 마치지 못했습니다. 잠시 뒤 GAID 서재에서 다시 시작하세요. | The hub server could not finish the ORCID check. Try again later from the GAID library. → The institute Connect server could not finish the ORCID check. Try again later from the GAID library. |
| `server.orcid.callback.success` | `server/src/geo/routes/orcid.ts` | ORCID 본인 확인을 마쳤습니다. ${result.orcid} iD를 허브 계정에 연결했습니다. 이 탭을 닫고 GAID로 돌아가세요. → ORCID 본인 확인을 마쳤습니다. ${result.orcid} iD를 Connect 계정에 연결했습니다. 이 탭을 닫고 GAID로 돌아가세요. | ORCID sign-in finished: ${result.orcid} is linked to your hub account. Close this tab and return to GAID. → ORCID sign-in finished: ${result.orcid} is linked to your Connect account. Close this tab and return to GAID. |

## Inspected and intentionally unchanged

`server/src/geo/orcid/service.ts`, `server/src/geo/hub-client/{client,connection,remote-store}.ts` and `server/src/geo/routes/hub-server.ts` expose their error text only inside technical disclosures in `web/src/geo/orcid/orcid-card.tsx`, `web/src/geo/hub-server/parts.tsx` and `web/src/geo/hub-feeds/feeds.tsx`. Their strings, model-facing prompts, logs, codes and identifiers are unchanged.

## Documents

Updated `geo/copy/terminology.csv`, `docs/glossary.md`, `AGENTS.md`, UI guide L2/N1/N5/D6, the accepted Connect/Workspace ADR, a one-line partial-supersession note in the 2026-10-21 library ADR, and the current Connect authoring service design. User quotes and historical ADR content remain intact. Terminology forbids the unambiguous old names; bare 허브 and 내 연구 remain context-scoped because the validator matches substrings.

The prose was edited in humanizer file mode (§25: direct definitions; Korean K1/K3/K5: direct verbs, natural grammar and consistent terms). Names, dates, source paths, user quotations, version semantics and limits were retained.

## Counts

- Locale ids: 147.
- Additional server source labels: 8.
- Total changed copy entries: 155.

## Verification

- Source snapshot: `dc1af6c8bd99` (subsequent commits change the task document only).
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 38 catalogues, 0 errors, 101 existing warnings.
- `node geo/ui/check-ui.mjs`: 15,270 strings, 0 errors, 78 accepted debt; baseline unchanged.
- Server typecheck passed; 3 suites / 19 tests passed (`geo-hub-pins`, `geo-hub-orcid`, `geo-orcid`).
- Web `tsc --noEmit` passed; 18 suites / 171 tests passed, covering the changed string assertions, i18n and note exports.
- Managed verification job exited 0: `/home/seongin3/data/geoaidesk/runs/gaid-ia-connect-workspace--copy-rename-20261024T064408.558164Z/receipt.json`. Web output included non-failing React `act(...)` and jsdom navigation notices; no runtime code was changed to suppress them.
- `git diff --check` passed. The parent runs the full integrated `scripts/check` after child integration.

Full-check note: the first automatic `task finish` check stopped after backend tests because unchanged `test/geo-workspace.test.ts:349` exceeded 5,000 ms. Backend totals: 2,322 passed, 8 skipped, 1 timeout. The entire file passed an isolated rerun (19/19, 4.75 s) without source changes. The finish check is retried with one Vitest worker; this does not change test assertions or timeouts.

The retry passed the full backend: 211 suites passed / 1 skipped, 2,323 tests passed / 8 skipped. The prior session-exposure timeout did not recur. Full frontend/distribution checks continue through the normal finish command.

The retry also passed all 1,336 frontend tests, launcher/distribution checks, copy/UI checks and catalogue environment import checks. Production smoke and UI quality checks continue through the finish command.

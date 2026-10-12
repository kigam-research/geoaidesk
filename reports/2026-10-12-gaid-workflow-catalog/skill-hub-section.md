## skill_hub 스킬 탐색·설치 연결

설정의 스킬 추가 화면에서 skill_hub 사이트를 열고, 스킬 페이지 URL 또는 다운로드한 패키지 파일을 미리보기할 수 있습니다. 미리보기에 나온 스킬을 선택하고 전체 권한 실행에 동의한 뒤 기존 설치 버튼으로 설치합니다. 같은 이름의 기본 카탈로그 스킬이 있으면, 설치 대신 목록에서 켤 수 있다고 안내합니다.

> "그리고 스킬을 추가할 때에는 skill_hub 프로젝트에서 작업한 skill_hub 사이트를 클릭하여 스킬을 탐색하고 해당 사이트에서 스킬을 가져올 수
> 있게 연계하는 방안도 검토 후 적용해보아야 한다."

### 검토한 연결 방식

| 방식 | 판단과 적용 결과 |
|---|---|
| Git 저장소 직접 설치 | 기존 기능은 유지합니다. skill_hub 저장소는 비공개이며 KIGAM 스킬별 공개 Git 원본이 없어 기본 연결로 선택하지 않았습니다. |
| 스킬 페이지 URL → 패키지 다운로드 | 적용했습니다. 설정된 사이트의 페이지 URL을 공개 패키지 주소로 바꿔 읽습니다. 임의의 다운로드 URL과 리디렉션은 허용하지 않습니다. |
| 다운로드한 패키지 파일 선택 | 적용했습니다. 사이트에서 받은 압축 파일을 선택해 같은 미리보기·동의·설치 절차로 가져옵니다. |
| 사이트 → 로컬 앱 deep link | 적용하지 않았습니다. 공개 사이트에서 로컬 앱을 직접 호출하는 전제가 없고 기존 계획도 해당 방식을 제외합니다. |

### 동작과 한계

- 현재 연결 대상은 공개 Geo Skill Atlas입니다. 새 skill_hub 사이트는 공개 배포 후 설정에 추가할 수 있습니다.
- 패키지는 스킬 폴더 하나와 그 안의 지침 파일을 포함해야 합니다. 압축 크기 20 MiB, 해제 후 64 MiB, 항목 10,000개까지 받습니다. 링크, 상위 경로, 중복 경로를 거부합니다.
- 패키지는 내용 해시별로 앱 데이터에 보관합니다. 기존 임시 캐시가 지워져도 보관한 원본으로 다시 준비할 수 있습니다. 미리보기와 설치는 기존 내용 지문을 주고받습니다.
- 같은 이름의 카탈로그 스킬이 있다는 안내는 내용이나 버전이 같다는 뜻이 아닙니다. 이미 설치된 스킬을 교체한다는 기존 경고도 유지합니다.
- 사이트 변경 사항을 자동으로 받아오지 않습니다. 새 버전은 사이트 URL이나 새 패키지로 다시 미리보기해야 합니다.
- 선택 사항인 기존 스킬 목록의 사이트 상세 링크는 이번 범위에서 추가하지 않았습니다. 추가 화면의 탐색 링크와 카탈로그 중복 안내를 제공합니다.

### 확인한 범위

서버 시험 16개와 화면 시험 4개가 통과했습니다. 서버·화면 타입 검사와 문구 검사도 통과했습니다. 문구 검사에는 기존 경고 1개와 자동 갱신을 하지 않는다는 설명의 경고 2개가 남습니다. 후자는 실제 동작의 한계를 설명하므로 유지합니다.

실제 앱에서 URL 입력·미리보기·동의·설치와 두 화면 캡처는 현재 기록된 별도 실행에서 확인 중입니다. 완료 결과를 이 절에 반영합니다. 전체 검사와 부모 작업의 최종 통합은 부모 작업에서 확인합니다.

### skill_hub 프로젝트에 전달할 요청안

> GAID 스킬 추가 화면에 공개 skill_hub 사이트 탐색, 스킬 페이지 URL 붙여넣기, 다운로드 패키지 선택을 연결했습니다. 새 공개 사이트의 스킬 상세 페이지에 ‘GAID에서 설치’ 안내를 추가해 주세요. 안내에는 페이지 URL을 복사해 GAID의 스킬 미리보기에 붙여넣는 절차와 패키지 다운로드 대안을 함께 적어 주세요. 로컬 앱 deep link는 전제로 삼지 않습니다. 새 사이트를 공개 배포하고 스킬 페이지와 공개 패키지 주소를 안정적으로 유지해 주세요. 공개 Git 원본으로 배포할 계획이 있다면 스킬별 저장소 또는 경로와 라이선스 정보를 함께 제공해 주세요. GAID는 공개 URL이 확인된 뒤 허용 사이트 설정에 추가할 수 있습니다.

### 부록: 구현·시험 근거

- 구현 스냅샷: `b3aa2370d63c` (후속 문서·증거 커밋은 작업 문서에 기록합니다).
- 설정: `geo/distribution.json`의 `skillHub.sites`.
- 서버: `server/src/geo/skill-hub.ts`, `server/src/geo/routes/skill-hub.ts`.
- 화면: `web/src/geo/skill-hub/skill-hub.tsx`, `web/src/components/skills-panel.tsx`의 좁은 연결 지점.
- 시험: `cd server && npx vitest run test/geo-skill-hub.test.ts`; `cd web && npx vitest run src/geo/skill-hub/skill-hub.test.tsx`; 각 폴더의 `npx tsc --noEmit`; `node geo/copy/validate-copy.mjs web/src/geo/locales`.
- 실제 패키지: `https://kigam-research.github.io/skill-atlas/api/catalog/packages/kigam/well-log-qc-quicklook/well-log-qc-quicklook.tar.gz`.
- 별도 앱 시험 실행: `job-geoaidesk-gaid-workflow-catalog--skill-hub-2`. 사용자 앱과 검토 인스턴스는 변경하지 않습니다.

### 부록: 새 문구

모든 문자열은 신규이며 변경 전 값은 없습니다. 아래 값은 미리보기 대기·읽는 중·실패·카탈로그 중복·권한 동의 상태에 대응합니다. 기존 설치 경고와 설치 버튼 문구는 유지합니다.

| 문자열 id | 변경 전 | 한국어 변경 후 | 영어 변경 후 |
|---|---|---|---|
| `skillHub.title` | 없음(신규) | skill_hub 스킬 추가 | Add skills from skill_hub |
| `skillHub.browse` | 없음(신규) | skill_hub에서 스킬 찾기 | Find skills on skill_hub |
| `skillHub.url` | 없음(신규) | 스킬 페이지 URL | Skill page URL |
| `skillHub.placeholder` | 없음(신규) | skill_hub 스킬 페이지 URL을 붙여넣으세요 | Paste a skill_hub skill page URL |
| `skillHub.preview` | 없음(신규) | 스킬 미리보기 | Preview skill |
| `skillHub.file` | 없음(신규) | 스킬 패키지 파일 (.tar.gz) | Skill package file (.tar.gz) |
| `skillHub.upload` | 없음(신규) | 패키지 미리보기 | Preview package |
| `skillHub.help` | 없음(신규) | 사이트에서 스킬을 찾은 뒤 페이지 URL을 붙여넣거나 다운로드한 .tar.gz 파일을 선택하세요. 미리보기와 권한 동의 후 설치합니다. | Find a skill on the site, then paste its page URL or choose the downloaded .tar.gz file. Review the preview and acknowledge permissions before installing. |
| `skillHub.sizeHelp` | 없음(신규) | 파일 크기는 압축 상태 20 MiB, 압축 해제 후 64 MiB, 항목 10,000개로 제한합니다. | Packages are limited to 20 MiB compressed, 64 MiB expanded and 10,000 entries. |
| `skillHub.loading` | 없음(신규) | 스킬 패키지를 읽는 중입니다. | Reading the skill package. |
| `skillHub.catalogue` | 없음(신규) | 기본 카탈로그에 같은 이름의 스킬이 있습니다: {names}. 설치 대신 목록에서 기본 카탈로그 스킬을 켤 수 있습니다. | The default catalogue includes skills with the same names: {names}. You can enable the catalogue copies in the list instead of installing. |
| `skillHub.catalogueUnavailable` | 없음(신규) | 기본 카탈로그를 읽지 못해 같은 이름의 스킬이 있는지 확인하지 못했습니다. | Could not read the default catalogue to check for skills with the same names. |
| `skillHub.snapshot` | 없음(신규) | 패키지 SHA-256: {digest}. 설치 후 사이트 변경 사항을 자동으로 가져오지 않습니다. | Package SHA-256: {digest}. Changes on the site are not fetched automatically after installation. |
| `skillHub.trust` | 없음(신규) | {source}의 스킬이 AI agent의 전체 권한으로 실행됨을 이해하고 설치에 동의합니다. | I understand that skills from {source} run with the AI agent's full permissions and agree to install them. |
| `skillHub.source` | 없음(신규) | skill_hub 패키지 {digest} | skill_hub package {digest} |
| `skillHub.errors.url` | 없음(신규) | 설정된 skill_hub 사이트의 스킬 페이지 URL을 입력하세요. | Enter a skill page URL on a configured skill_hub site. |
| `skillHub.errors.download` | 없음(신규) | 스킬 패키지를 다운로드하지 못했습니다. 사이트 연결을 확인하거나 다운로드한 파일을 선택하세요. | Could not download the skill package. Check the site connection or choose a downloaded file. |
| `skillHub.errors.size` | 없음(신규) | 패키지가 크기 또는 항목 수 제한을 넘었습니다. 더 작은 패키지를 선택하세요. | The package exceeds the size or entry limit. Choose a smaller package. |
| `skillHub.errors.archive` | 없음(신규) | 패키지를 읽지 못했습니다. SKILL.md가 있는 스킬 폴더 하나를 담은 .tar.gz 파일을 선택하세요. 링크와 상위 경로는 허용하지 않습니다. | Could not read the package. Choose a .tar.gz containing one skill folder with SKILL.md. Links and parent paths are not allowed. |
| `skillHub.errors.input` | 없음(신규) | 스킬 페이지 URL 또는 .tar.gz 파일을 선택하세요. | Enter a skill page URL or choose a .tar.gz file. |
| `skillHub.errors.request` | 없음(신규) | 스킬 미리보기를 불러오지 못했습니다. 다시 시도하세요. | Could not load the skill preview. Try again. |

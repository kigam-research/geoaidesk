# Agent prompt block for user-facing copy (spec 4.6)

Add the Korean block verbatim to the fork's AGENTS.md and to every UI package goal (WP03-WP05, WP07, WP08, WP09). The
English block states the same rules for agents that work in English; it does not replace the Korean one.

## Korean (verbatim from docs/specs/geo-byok-plan.md 4.6)

```text
사용자 표시 문구를 바꾸기 전에 design/copy/gaid-writing.md, terminology.csv, 해당 화면의 상태 정의를 읽는다. 문구는 문자열
카탈로그에 넣고 JSX에 직접 쓰지 않는다. 한국어를 먼저 쓰고 영어는 같은 동작·조건·한계로 쓴다. 버튼은 다음 동작을 쓴다(한국어
목적어+동작, 영어 동사+목적어). 질문형 제목, 추상적 변환 문장, 과장 형용사, 장식 이모지를 쓰지 않는다. 실행 완료를 검증 완료로
바꾸지 않는다. 추정·미시험·검토 전 같은 한계를 지우지 않는다. 확인되지 않은 기능·지원 환경·성능·비용을 쓰지 않는다. 변경 보고에
문자열 id와 한·영 변경 전후를 적는다.
```

## English

```text
Before changing user-facing text, read design/copy/gaid-writing.md, design/copy/terminology.csv and the state
definition of the screen. Put strings in the string catalogue, never inline in JSX. Write Korean first; write English
with the same action, condition and limit. Buttons name the next action (Korean object + action, English verb +
object). Do not write question headlines, abstract transformation sentences, hype adjectives or decorative emoji. Do
not turn "run complete" into "verified". Do not remove limits such as estimate, untested or not reviewed. Do not state
unconfirmed features, supported environments, performance or cost. Run `node design/copy/validate-copy.mjs <catalogue
dirs>` and fix its errors. In the change report, list the string ids with the Korean and English text before and after.
```

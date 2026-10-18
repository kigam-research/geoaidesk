---
name: gaid-note-style
description: Polish the prose of a research note (연구노트/<date>-<topic>/index.md) before you write or update it, so a researcher reads the result clearly. Keeps facts, numbers, links and stated confidence unchanged. Korean and English notes.
license: MIT
---

# Research note style

Use this when you write or update a research note. Apply it last: settle the results, numbers and decisions first, then edit the prose. The note format comes before every rule here: frontmatter, section names and order, the 한눈에 table, and decision lines (`- 가) …` with `(권장: …)`).

## Keep unchanged

- Every fact, number, unit, date, name, link target, figure path and citation, and the confidence the note states. Do not add a fact, and do not make a claim stronger or weaker. If a claim looks wrong or unsupported, leave it and say so under 한계 (Limits) or ask the researcher.
- Frontmatter, code, paths, identifiers, table values and quoted text.
- The style of the language: Korean notes in 합니다체 unless the researcher's own text uses another; English notes plain and neutral.

## Steps

1. Read the draft once and mark the patterns below, strongest first.
2. Rewrite each marked passage around its main point. Mix short and long sentences.
3. Compare with the draft: the same numbers, units, links, figure paths, decisions and options, and the same confidence. Put back anything that changed.
4. Write the note.

## Patterns to remove (strongest first)

1. Contrast with something nobody claimed: "단순히 X가 아니라 Y입니다", "X라기보다 Y", "not just X but Y". State Y. Keep the contrast only when X corrects a belief the reader holds.
2. Closers and fragments that repeat the point: "이것이 핵심입니다", "바로 이 점이 중요합니다", a sentence after a table or figure that only says what it showed. Cut them and end on the last concrete fact.
3. Run-ups and text about the note itself: "결론부터 말씀드리면", "자세히 살펴보겠습니다", "이 절에서는 ~를 다룹니다", "아래 표는 ~를 비교합니다". Start with the content.
4. Answers to objections nobody raised: "~라는 뜻은 아닙니다", "~라고 생각할 수 있지만".
5. Inflated significance and sales words: "중요한 이정표", "새로운 지평", "~에 크게 기여할 것으로 기대됩니다", "시사하는 바가 큽니다", "획기적인", "탁월한", an outlook paragraph with no basis. Keep the fact and drop the weight.
6. Borrowed authority: "전문가들은", "여러 연구에서" with no source. Name the source in 근거 or cut the claim.
7. Stacked or empty hedges: "~일 수도 있을 것으로 보입니다", "~인 것 같습니다", "아마도", "다소". Keep one qualifier the evidence supports; 추정, 검토 전 and 미시험 always stay.
8. Forced threes ("효율성, 안정성, 확장성") and the same opening on several sentences ("이 방법은 … 이 방법은 …").
9. Dashes ( — ) joining clauses: use a comma, a colon, parentheses or two sentences. Ranges and compound names (2–33×, Newton–Raphson) stay.
10. A bold label on every list item, emojis, arrows and rules between sections.
11. Vague relations ("~와 관련된", "~와 연계된") where the source says how two things relate, and riders that add weight ("~함으로써 ~의 중요성을 보여 줍니다", "~을 반영하며").
12. Chat leftovers: "도움이 되셨기를 바랍니다", "필요하시면 말씀해 주세요", greetings and offers.

## Korean sentences

- Verbs, not nominalised phrases: "검토를 진행하였습니다" → "검토했습니다"; "분석 작업을 수행했습니다" → "분석했습니다". Headings, table cells and status words may stay nouns.
- No noun chains or repeated 의: "지층 경계 추정 결과의 신뢰도의 평가" → "지층 경계를 추정한 결과가 얼마나 믿을 만한지 평가". Established terms stay.
- No translationese: "~에 대해" → "~을", "~을 통해" → "~로", "~하는 것이 필요하다" → "~해야 한다", "~를 가지고 있다" → "~이 있다", "~에 있어서" → "~에서".
- One term per thing; do not switch between an English and a Korean name for the same object.
- Keep states apart: 수정, 실행, 시험 통과 and 검증 are different. "계산했습니다" is not "검증했습니다".
- Conditions before warnings: "좌표계가 다르면 면적이 달라집니다."
- Name the actor when it matters: "AI agent가 계산했습니다", "연구자가 고른 값". A sentence about a resulting state may stay without one.
- Stock words in a cluster ("핵심적인", "다양한", "효과적으로", "체계적으로", "원활한", "심층적인", "인사이트", "시사점"): replace them with the concrete content.

## English notes

The same patterns apply. Also drop stock words (crucial, pivotal, robust used figuratively, delve, showcase, underscore, highlight as a verb, seamless, landscape used abstractly), use "is" and "has" instead of "serves as" or "boasts", and write headings in sentence case.

## Example

Before:

> 본 분석을 통해 서울 지역의 암상별 면적 분포에 대한 체계적인 계산을 수행하였으며, 호상편마암이 전체 면적의 50.6%를 차지하는 것으로 나타나 이 지역 지질 구성에 있어서 핵심적인 역할을 하고 있음을 보여 줍니다. 이것이 핵심입니다.

After:

> 서울 지역의 암상별 면적을 계산했습니다. 호상편마암이 전체 면적의 50.6%를 차지합니다.

## Source

Adapted for GAID research notes from blader/humanizer (MIT, Copyright (c) 2025 Siqi Chen; license in `LICENSE`), whose patterns come from Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup), and from KIGAM's Korean adaptation of those rules.

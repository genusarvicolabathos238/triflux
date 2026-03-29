---
name: tfx-deep-review
description: "철저한 코드 리뷰가 필요할 때 사용한다. '꼼꼼히 리뷰', 'deep review', '심층 리뷰', '보안까지 리뷰', '다각도 리뷰', '중요한 변경이라 제대로 봐줘' 같은 요청에 사용. 보안/성능/가독성 3관점 독립 검증이 필요한 중요 코드 변경에 적극 활용."
triggers:
  - deep review
  - 심층 리뷰
  - multi review
  - deep-review
  - 철저한 리뷰
argument-hint: "[파일 경로 또는 변경 설명]"
---

# tfx-deep-review — Tri-CLI Deep Code Review

> 3-CLI 독립 리뷰 → 교차검증 → 2+ 합의 항목만 보고. Diffray + Calimero 영감.

## 핵심 원리

**Anti-Herding**: Round 1에서 3개 CLI가 서로의 결과를 보지 않고 독립 리뷰.
**Consensus Only**: 2개 이상 CLI가 동일 이슈를 지적한 항목만 최종 보고 → false-positive 87% 감소.

## 워크플로우

### Step 1: 리뷰 대상 수집
```
git diff (staged + unstaged) 또는 지정 파일 수집
```

### Step 2: 3-CLI 독립 리뷰 (동시, 상호 비공개)

```
Claude Opus (Agent, background):
  관점: 로직 결함, 아키텍처 위반, 설계 패턴
  "코드 리뷰어로서 로직/아키텍처 관점에서 분석하라.
   JSON: { findings: [{ id, file, line, severity, category, description, suggestion }] }"

Codex (Bash, background):
  관점: 보안 취약점, 성능 병목, 에러 핸들링
  codex exec review --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
  "보안/성능 전문가로서 분석하라. OWASP Top 10, O(n²) 패턴, 누락된 에러 핸들링.
   JSON: { findings: [...] }"

Gemini (Bash, background):
  관점: 가독성, 문서화, 네이밍, DX
  gemini -y -p \
  "코드 품질 전문가로서 분석하라. 가독성, 네이밍 컨벤션, 주석 필요성, 타입 안전성.
   JSON: { findings: [...] }"
```

### Step 3: Consensus Scoring

```
모든 findings를 수집하여 유사도 비교:
  - 동일 파일+라인±5 + 유사 카테고리 → 동일 이슈로 간주
  - 3/3 합의 → severity 유지
  - 2/3 합의 → severity 유지, 반대 의견 첨부
  - 1/3만 지적 → UNVERIFIED 표시 (참고용, 별도 섹션)

consensus_score = consensus_items / total_unique_items × 100
```

### Step 4: 종합 보고서

```markdown
## Deep Code Review: {target}
**Consensus Score**: {score}% | **Reviewers**: Claude/Codex/Gemini

### Critical (3/3 합의)
- [C1] `{file}:{line}` — {description}
  - Claude: {detail} | Codex: {detail} | Gemini: {detail}
  - **Fix**: {suggestion}

### High (2/3 합의)
- [H1] `{file}:{line}` — {description}
  - 합의: {agreers} | 반대: {dissenter}: "{reason}"

### Verified Medium
- ...

### Unverified (1/3만 지적, 참고용)
- [U1] `{file}:{line}` — {description} (by {single_cli})

### 통계
| CLI | 발견 수 | 합의 기여율 |
|-----|---------|------------|
| Claude | {n} | {%} |
| Codex | {n} | {%} |
| Gemini | {n} | {%} |
```

## 토큰: ~25K

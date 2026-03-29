---
name: tfx-deep-qa
description: "보안, 성능, 접근성까지 포함한 철저한 검증이 필요할 때 사용한다. 'deep qa', '심층 검증', '철저히 테스트', '보안까지 확인', '전방위 검증' 같은 요청에 사용. 프로덕션 배포 전 다각도 품질 검증에 적극 활용."
triggers:
  - deep qa
  - 심층 검증
  - thorough test
  - deep-qa
argument-hint: "[테스트 대상 경로 또는 기능 설명]"
---

# tfx-deep-qa — Tri-CLI Deep Verification

> 3-CLI 독립 검증 → 교차검증 → 2+ 합의 항목만 보고. false-positive 87% 감소.

## 핵심 원리

**Anti-Herding**: 3개 CLI가 서로의 결과를 보지 않고 독립 검증.
**Consensus Only**: 2개 이상 CLI가 동일 이슈를 지적한 항목만 최종 보고.

## 용도

- 릴리스 전 전면 검증
- 보안/성능/접근성을 동시에 다각도 점검
- 단일 CLI 검증으로는 놓치는 교차 영역 결함 탐지
- false-positive 최소화가 필요한 QA 게이트

## 워크플로우

### Step 1: 검증 대상 수집

```
대상 결정:
  1. 사용자 지정 파일/경로 → 해당 범위
  2. git diff (staged + unstaged) → 변경된 파일
  3. 지정 없음 → 프로젝트 전체 테스트

수집 항목:
  - 변경 파일 목록 + diff
  - 관련 테스트 파일
  - 영향 받는 모듈/의존성
```

### Step 2: 3-CLI 독립 검증 (동시, 상호 비공개)

```
Claude Opus (기능 + 엣지케이스, background):
  "QA 엔지니어로서 다음 코드의 기능 정확성을 검증하라.
   - 테스트 실행 후 결과 보고
   - 누락된 엣지 케이스 식별 (null, 빈 입력, 경계값, 동시성)
   - 누락된 테스트 케이스 제안
   JSON: { test_result: {pass, fail, skip},
           findings: [{id, file, line, category, severity, description, test_scenario}],
           edge_case_tests: [...],
           overall_verdict: 'pass'|'fail' }"

Codex (보안 + 성능, background):
  codex exec review --profile thorough \
    --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
  "보안/성능 전문가로서 검증하라.
   - OWASP Top 10 체크
   - O(n²) 이상 복잡도 탐지
   - 메모리 누수 패턴
   - 입력 검증 누락
   JSON: { findings: [{id, file, line, category, severity, description, fix}],
           overall_verdict: 'pass'|'fail' }"

Gemini (UX + 접근성, background):
  gemini -y -p \
  "UX/접근성 전문가로서 검증하라.
   - API 응답 형식 일관성
   - 에러 메시지 사용자 친화성
   - WCAG 2.1 AA 준수 (UI 관련 시)
   - 문서와 실제 동작 일치 여부
   JSON: { findings: [{id, file, line, category, severity, description, suggestion}],
           overall_verdict: 'pass'|'fail' }"
```

### Step 3: Consensus Scoring

```
모든 findings를 수집하여 유사도 비교:
  - 동일 파일+라인±5 + 유사 카테고리 → 동일 이슈로 간주
  - 3/3 합의 → CONFIRMED (severity 유지)
  - 2/3 합의 → LIKELY (severity 유지, 반대 의견 첨부)
  - 1/3만 지적 → UNVERIFIED (참고용, 별도 섹션)

consensus_score = consensus_items / total_unique_items × 100
```

### Step 4: 실패 수정 (합의된 항목만)

```
합의된 Critical/High 항목에 대해:
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
  "다음 합의된 이슈를 수정하라:
   {consensus_findings}
   수정 후 테스트를 재실행하여 확인하라."
```

### Step 5: 종합 보고서

```markdown
## Deep QA Report: {target}
**Consensus Score**: {score}% | **Verifiers**: Claude/Codex/Gemini
**Verdict**: PASS / CONDITIONAL PASS / FAIL

### Critical (3/3 합의)
- [C1] `{file}:{line}` — {description}
  - Claude: {detail} | Codex: {detail} | Gemini: {detail}
  - **Fix**: {applied_fix}

### High (2/3 합의)
- [H1] `{file}:{line}` — {description}
  - 합의: {agreers} | 반대: {dissenter}: "{reason}"

### Verified Medium
- ...

### 엣지 케이스 테스트 제안
| 시나리오 | 입력 | 기대 결과 | 제안자 |
|---------|------|----------|--------|
| {scenario} | {input} | {expected} | Claude |

### Unverified (1/3만 지적, 참고용)
- [U1] `{file}:{line}` — {description} (by {single_cli})

### 수정 요약
- 수정된 파일: {list}
- 테스트 재실행 결과: {pass}/{total}

### 검증 통계
| CLI | 영역 | 발견 수 | 합의 기여율 |
|-----|------|---------|------------|
| Claude | 기능/엣지케이스 | {n} | {%} |
| Codex | 보안/성능 | {n} | {%} |
| Gemini | UX/접근성 | {n} | {%} |
```

## 토큰 예산

| 단계 | 토큰 |
|------|------|
| Step 1 (수집) | ~1K |
| Step 2 (3x 독립 검증) | ~15K |
| Step 3 (Consensus) | ~3K |
| Step 4 (수정) | ~3K |
| Step 5 (보고) | ~3K |
| **총합** | **~25K** |

## 사용 예

```
/tfx-deep-qa
/tfx-deep-qa "src/auth/ 디렉토리 전체"
/tfx-deep-qa "최근 커밋 변경사항 심층 검증"
/tfx-deep-qa "결제 모듈 배포 전 최종 검증"
```

---
name: tfx-deep-autopilot
description: 5-Phase 전체 개발 파이프라인. Expansion(Opus) → Planning(3자합의) → Execution(Codex+Gemini) → QA(3자독립리뷰) → Validation(Consensus>=70). OMC autopilot + Superpowers TDD + MetaGPT SOP 영감.
triggers:
  - deep autopilot
  - 풀 오토
  - 처음부터 끝까지
  - full auto
argument-hint: "<구현할 기능 전체 설명>"
---

# tfx-deep-autopilot — Full Development Pipeline with Tri-CLI Consensus

> 5-Phase 파이프라인: Expansion → Planning → Execution → QA → Validation.
> OMC autopilot + Superpowers TDD + MetaGPT SOP 영감. 처음부터 끝까지 자율 실행.

## 핵심 원리

단순 autopilot은 "구현 → 검증" 2단계. Deep autopilot은 **계획 단계부터 3자 합의**, **구현은 분업**, **검증은 3자 독립 리뷰** — 전체 소프트웨어 개발 SOP를 자동화한다.

## 용도

- 신규 기능 전체 구현 (설계 → 코드 → 테스트 → 검증)
- 대규모 리팩터링
- 복잡한 버그 수정 (재현 → 분석 → 수정 → 회귀 검증)
- "처음부터 끝까지 알아서 해" 류의 복합 요청

## 워크플로우

### Phase 1: Expansion (Claude Opus)

요구사항을 분석하고 구현 범위를 확장한다:

```
Claude Opus:
  "소프트웨어 아키텍트로서 다음 요구사항을 분석하라:
   요구사항: {user_request}
   프로젝트 컨텍스트: {context from PROJECT_INDEX.md}

   출력:
   1. 요구사항 해석 및 범위 정의
   2. 영향 받는 파일/모듈 목록
   3. 엣지 케이스 및 고려사항
   4. 암묵적 요구사항 (사용자가 언급하지 않았지만 필요한 것)
   5. acceptance criteria 목록 (검증 가능한 형태)"
```

모호한 점이 있으면 AskUserQuestion으로 사용자 확인.

### Phase 2: Planning (3자 합의)

**3개 CLI가 동시에, 상호 결과를 보지 않고 독립 계획 수립.**

```
Claude Opus (Planner, background):
  "다음 기능의 구현 계획을 수립하라:
   기능: {expanded_requirements}
   태스크 분해, 순서, 의존성, TDD 전략 포함.
   JSON: { tasks, order, dependencies, tdd_strategy, risks }"

Codex (Architect, background):
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
  "시니어 엔지니어로서 기술적 설계를 작성하라:
   기능: {expanded_requirements}
   파일 구조, API 인터페이스, 데이터 모델 포함.
   JSON: { design, file_changes, interfaces, test_plan }"

Gemini (Critic, background):
  gemini -y -p \
  "QA 전문가로서 구현 계획의 리스크를 분석하라:
   기능: {expanded_requirements}
   엣지 케이스, 보안, 성능, 접근성 우려 포함.
   JSON: { edge_cases, security_risks, performance, accessibility, test_cases }"
```

3개 결과를 tfx-consensus 프로토콜로 합의 도출:
```
Consensus Score >= 70 → Phase 3 진행
Consensus Score < 70 → Round 2 교차검토 → 재합의
Round 2 후에도 < 60 → 사용자에게 불일치 제시 + 방향 결정 요청
```

### Phase 3: Execution (Codex + Gemini 분업)

합의된 계획에 따라 태스크를 병렬 실행:

```
태스크 라우팅:
  코드 구현/수정 → Codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check
  테스트 작성 → Codex (TDD: 테스트 먼저 → RED 확인 → 구현 → GREEN)
  UI/문서 → Gemini -y -p

실행 순서:
  1. 테스트 먼저 작성 (TDD RED phase)
  2. 구현 코드 작성 (TDD GREEN phase)
  3. 리팩터링 (TDD REFACTOR phase)
  4. 통합 테스트 실행

병렬 가능 태스크는 동시 실행:
  독립 모듈 A (Codex pane 1) | 독립 모듈 B (Codex pane 2) | 문서 (Gemini)
```

각 태스크 완료 시 단순 검증 (테스트 통과 여부) 확인 후 다음 진행.

### Phase 4: QA (3자 독립 리뷰)

**전체 변경사항에 대해 3개 CLI가 독립 리뷰한다.**

```
Claude (기능 + 엣지케이스, background):
  "다음 변경사항이 acceptance criteria를 충족하는지 검증하라:
   criteria: {acceptance_criteria}
   변경 파일: {changed_files}
   각 criterion별 PASS/FAIL + 근거.
   엣지 케이스 테스트 시나리오 제안.
   JSON: { criteria_results, edge_case_findings, overall_pass }"

Codex (보안 + 성능, background):
  codex exec review --profile thorough \
    --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
  "보안/성능 관점에서 변경사항을 리뷰하라:
   OWASP Top 10, 성능 병목, 에러 핸들링, 리소스 누수 확인.
   JSON: { security_findings, performance_findings, overall_pass }"

Gemini (UX + 접근성, background):
  gemini -y -p \
  "UX/접근성 관점에서 변경사항을 리뷰하라:
   UI 변경 있으면: 접근성, 반응형, 사용성.
   API 변경 있으면: DX, 문서화, 일관성.
   JSON: { ux_findings, accessibility_findings, overall_pass }"
```

### Phase 5: Validation (Consensus >= 70)

Phase 4 결과에 tfx-consensus 프로토콜 적용:

```
Consensus 판정:
  Score >= 70 + Critical 0건 → 완료 확정
  Score >= 70 + Critical 존재 → Critical만 수정 후 재검증
  Score < 70 → 미합의 항목 수정 → Phase 4 재실행 (최대 2회)
  2회 재실행 후에도 < 70 → 사용자에게 보고 + 판단 요청
```

### Final: 완료 보고

```markdown
# Deep Autopilot 완료: {feature}

## Pipeline Summary
| Phase | 상태 | 소요 |
|-------|------|------|
| Expansion | ✓ | {criteria_count}개 기준 도출 |
| Planning | ✓ | Consensus {score}% (Round {n}) |
| Execution | ✓ | {task_count}개 태스크, {file_count}개 파일 변경 |
| QA | ✓ | 3자 독립 리뷰 완료 |
| Validation | ✓ | Consensus {score}%, Critical 0건 |

## 변경 사항
| 파일 | 작업 | 설명 |
|------|------|------|
| {file} | 생성/수정 | {summary} |

## Acceptance Criteria
- [x] {criterion1} — 3/3 PASS
- [x] {criterion2} — 2/3 PASS (Gemini: 조건부)

## QA 결과
- 보안: {findings_count}건 (모두 해결)
- 성능: {findings_count}건 (모두 해결)
- 테스트: {pass}/{total} 통과

## 미합의 사항 (있으면)
- {항목}: {각 CLI 입장}
```

## 토큰 예산

| Phase | 토큰 |
|-------|------|
| Phase 1 (Expansion) | ~5K |
| Phase 2 (Planning, 3x) | ~20K |
| Phase 3 (Execution) | ~25K |
| Phase 4 (QA, 3x) | ~18K |
| Phase 5 (Validation) | ~5K |
| 재시도 (필요 시) | +15K |
| **총합** | **~73-88K** |

## 사용 예

```
/tfx-deep-autopilot "JWT 인증 시스템 전체 구현. 로그인/로그아웃/리프레시/미들웨어/테스트"
/tfx-deep-autopilot "풀 오토 — 결제 모듈을 Stripe에서 Toss Payments로 마이그레이션"
/tfx-deep-autopilot "처음부터 끝까지 — REST API를 GraphQL로 점진적 전환, 기존 클라이언트 호환 유지"
```

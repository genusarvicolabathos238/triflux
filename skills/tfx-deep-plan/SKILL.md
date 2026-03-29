---
name: tfx-deep-plan
description: 3자 합의 계획. Planner(Claude) + Architect(Codex) + Critic(Gemini) 반복 토론으로 합의된 구현 계획 도출. OMC ralplan 오마주.
triggers:
  - deep plan
  - 합의 계획
  - consensus plan
  - deep-plan
  - 철저한 계획
  - ralplan
argument-hint: "<구현할 기능 설명>"
---

# tfx-deep-plan — Consensus Planning via Tri-CLI Debate

> OMC ralplan 오마주. Planner + Architect + Critic 3자 반복 토론으로 합의된 계획.

## 워크플로우

### Round 1: 독립 계획 (Anti-Herding)

```
Claude Opus (Planner):
  "소프트웨어 아키텍트로서 {feature}의 구현 계획을 수립하라.
   태스크 분해, 순서, 의존성, 검증 방법 포함.
   JSON: { tasks, dependencies, risks, complexity, reasoning }"

Codex (Architect):
  "시니어 엔지니어로서 {feature}의 기술적 설계를 작성하라.
   파일 구조, API 인터페이스, 데이터 모델, 에러 처리 포함.
   JSON: { design, file_changes, interfaces, data_models, risks }"

Gemini (Critic):
  "QA/보안 전문가로서 {feature} 구현 시 예상되는 문제를 분석하라.
   엣지 케이스, 보안 위협, 성능 병목, 테스트 전략 포함.
   JSON: { edge_cases, security_risks, performance_concerns, test_strategy }"
```

### Round 2: 교차 검토

각 CLI에게 다른 두 CLI의 결과를 제시:

```
Claude에게:
  "Architect 설계: {codex_result}
   Critic 우려: {gemini_result}
   이를 반영하여 계획을 수정하라. 수용/반박 근거 포함."

Codex에게:
  "Planner 계획: {claude_result}
   Critic 우려: {gemini_result}
   설계를 수정하라."

Gemini에게:
  "Planner 계획: {claude_result}
   Architect 설계: {codex_result}
   우려 사항이 해소되었는지 판단하라. 미해소 항목 지적."
```

### Round 3: 합의 도출 (필요 시)

```
Round 2 후 Consensus Score 산출:
  >= 80 → 합의 확정
  60-79 → Round 3 진행 (미합의 항목만)
  < 60 → 사용자에게 주요 불일치 제시 + 방향 결정 요청
```

### Final: 합의된 계획 출력

```markdown
## 합의된 구현 계획: {feature}
**Consensus Score**: {score}% | **Rounds**: {count}

### 아키텍처 결정
{3자 합의된 설계 방향}

### 태스크 (합의됨)
1. [ ] {태스크1} → 검증: {방법} — Planner ✓ Architect ✓ Critic ✓
2. [ ] {태스크2} → 검증: {방법} — Planner ✓ Architect ✓ Critic: "{조건부}"
...

### 파일 변경 계획
| 파일 | 작업 | 이유 |
|------|------|------|
| {file} | 생성/수정 | {reason} |

### 리스크 및 완화 (합의됨)
- {리스크}: {완화} — 3/3 합의

### 테스트 전략 (Critic 주도)
{Gemini가 제안하고 Claude/Codex가 합의한 테스트 전략}

### 미합의 사항
- {항목}: {각 CLI 입장 요약}
```

## 토큰 예산

| 라운드 | 토큰 |
|--------|------|
| Round 1 (3x 독립) | ~12K |
| Round 2 (3x 교차) | ~9K |
| Round 3 (필요시) | ~6K |
| 합의 종합 | ~3K |
| **총합** | **~20-30K** |

## 사용 예

```
/tfx-deep-plan "마이크로서비스 간 이벤트 기반 통신 도입"
/tfx-deep-plan "기존 REST API를 GraphQL로 점진적 마이그레이션"
```

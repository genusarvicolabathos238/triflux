---
name: tfx-consensus
description: 3자 합의 엔진 — 모든 Deep 스킬의 핵심 인프라. Claude/Codex/Gemini 독립 분석 결과를 교차검증하여 편향 없는 합의를 도출한다.
triggers: []
argument-hint: "(내부 전용 — Deep 스킬이 자동 호출)"
---

# tfx-consensus — Tri-CLI Consensus Engine

> 모든 Deep 스킬의 공통 기반. 3개 CLI의 독립 결과를 교차검증하여 합의 도출.

## Core Protocol

이 스킬은 직접 호출하지 않는다. `tfx-deep-*` 스킬이 내부적으로 사용한다.

## Consensus Algorithm

### Phase 1: Independent Analysis (Anti-Herding)

3개 CLI가 **동시에, 상호 결과를 보지 않고** 독립 분석한다. 이것이 핵심이다 — 한 CLI의 결과가 다른 CLI에 영향을 주면 편향이 발생한다.

```
실행 방식:
  ├─ Claude (Opus/Sonnet): Agent() 또는 /team worker로 실행
  ├─ Codex: Bash("codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check '{prompt}'")
  └─ Gemini: Bash("gemini -y -p '{prompt}'")

각 CLI에게 동일한 프롬프트를 전달하되, 출력 형식을 JSON으로 강제:
  {
    "findings": [
      { "id": "F1", "category": "...", "severity": "critical|high|medium|low", "description": "...", "evidence": "..." }
    ],
    "summary": "...",
    "confidence": 0.0-1.0
  }
```

### Phase 2: Cross-Validation

Claude가 3개 결과를 통합하여 교차검증한다:

```
입력: result_claude, result_codex, result_gemini

for each finding in ALL results:
  agreement_count = count(CLIs that found this or similar finding)

  if agreement_count >= 2:
    mark as "CONSENSUS" (합의됨)
  elif agreement_count == 1:
    mark as "DISPUTED" (미합의 — 추가 검증 필요)

consensus_score = len(CONSENSUS) / len(ALL_UNIQUE) * 100
```

### Phase 3: Resolution (consensus_score < 70일 때)

```
미합의 항목에 대해 2차 라운드:
  1. 각 CLI에게 다른 두 CLI의 반대 논거를 제시
  2. "수용(accept) 또는 반박(rebut)으로 응답하라"
  3. 수용이 2개 이상이면 CONSENSUS로 승격
  4. 여전히 미합의이면 사용자에게 판단 요청 (AskUserQuestion)
```

### Learned Weights (시간 기반 신뢰도)

```
각 CLI의 historical accuracy를 .omc/state/consensus-weights.json에 저장:
{
  "claude": { "accuracy": 0.85, "total": 100, "correct": 85 },
  "codex":  { "accuracy": 0.82, "total": 100, "correct": 82 },
  "gemini": { "accuracy": 0.78, "total": 100, "correct": 78 }
}

가중 투표 시 accuracy를 weight로 사용:
  weighted_score = (claude_vote * 0.85 + codex_vote * 0.82 + gemini_vote * 0.78) / (0.85 + 0.82 + 0.78)
```

## Output Format

```json
{
  "consensus_score": 85,
  "consensus_items": [...],
  "disputed_items": [...],
  "resolved_items": [...],
  "user_decision_needed": [...],
  "cli_weights": { "claude": 0.85, "codex": 0.82, "gemini": 0.78 }
}
```

## Integration Point

Deep 스킬에서 사용하는 방법:

```
1. 프롬프트 준비 (주제 + 분석 관점 + 출력 형식)
2. 3개 CLI 병렬 실행 (Bash background + Agent background)
3. 결과 수집
4. 위 Consensus Algorithm 적용
5. consensus_score >= 70 → 확정
6. consensus_score < 70 → Resolution Phase 진입
7. 최종 결과를 호출 스킬에 반환
```

## Token Budget

- Phase 1 (3x 독립분석): ~15K (각 5K)
- Phase 2 (교차검증): ~3K
- Phase 3 (Resolution, 필요 시): ~8K
- **총합**: 18-26K tokens

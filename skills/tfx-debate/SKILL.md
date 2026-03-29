---
name: tfx-debate
description: "기술 선택, 아키텍처 비교, 설계 결정에서 3-CLI 구조화 토론으로 최적 답을 도출한다. 'A vs B', '뭐가 나을까', '비교해줘', '어떤 걸 쓸까', '장단점', 'tradeoff' 같은 비교/선택 요청에 반드시 사용한다. 단순 질문이 아닌 여러 옵션 사이의 결정이 필요할 때 적극 활용."
triggers:
  - debate
  - 토론
  - 3자 토론
  - tri-debate
  - 멀티모델 토론
argument-hint: "<토론 주제 또는 질문>"
---

# tfx-debate — Tri-CLI Structured Debate

> 3개 CLI가 독립 분석 → 교차검증 → 합의 도출. Anti-herding으로 편향 없는 결론.

## 용도

- 설계 결정에서 최적 방향을 찾을 때
- 코드 아키텍처 선택지 비교
- 기술 선택 (프레임워크, 라이브러리, 접근법)
- 요구사항 해석이 모호할 때
- 어떤 주제든 다관점 분석이 필요할 때

## 워크플로우

### Step 1: 주제 파싱

사용자 입력에서 토론 주제를 추출한다. 주제가 모호하거나 비교 대상이 불명확하면 AskUserQuestion으로 명확화한다:

```
AskUserQuestion:
  "토론 주제를 더 구체적으로 선택해주세요:"
  1. {옵션A} vs {옵션B} 기술 비교
  2. {주제} 아키텍처 접근법 비교
  3. 직접 입력
```

주제가 명확한 경우 (예: "REST vs GraphQL") 이 단계를 건너뛴다.

```
입력: "REST vs GraphQL for our microservice API"
파싱: {
  topic: "REST vs GraphQL for microservice API",
  context: (프로젝트 컨텍스트에서 자동 추출),
  options: ["REST", "GraphQL"],  // 식별 가능하면
  criteria: ["성능", "개발 생산성", "유지보수", "학습 곡선"]
}
```

### Step 2: 독립 분석 (Anti-Herding)

**반드시 3개를 동시에, 상호 결과 비공개로 실행한다.**

```
Claude (Agent, background):
  "당신은 소프트웨어 아키텍트입니다. {topic}에 대해 분석하세요.
   프로젝트 컨텍스트: {context}
   각 옵션의 장점, 단점, 리스크를 구조화하세요.
   최종 추천과 근거를 제시하세요.
   JSON 형식으로 출력하세요: { recommendation, reasoning, pros, cons, risks, confidence }"

Codex (Bash, background):
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
    "당신은 시니어 백엔드 엔지니어입니다. {topic}에 대해 구현 관점에서 분석하세요.
     {context} 기반으로 각 옵션의 기술적 트레이드오프를 평가하세요.
     JSON: { recommendation, reasoning, pros, cons, risks, confidence }"

Gemini (Bash, background):
  gemini -y -p \
    "당신은 DevOps/인프라 엔지니어이자 DX 전문가입니다. {topic}에 대해 운영+개발자경험 관점에서 분석하세요.
     {context}. JSON: { recommendation, reasoning, pros, cons, risks, confidence }"
```

### Step 3: 결과 수집 및 교차검증

3개 결과가 모두 수집되면 tfx-consensus 프로토콜 적용:

```
합의 분석:
  - 3/3 동일 추천 → "만장일치" (Strong Consensus)
  - 2/3 동일 추천 → "다수 합의" (Majority Consensus)
  - 3개 모두 다름 → "불일치" (Disputed → Round 2 필요)

항목별 교차검증:
  - 2+ CLI가 동일 장점/단점 지적 → 확정
  - 1개 CLI만 지적 → "미검증" 표시
```

### Step 4: 토론 라운드 (불일치 시)

불일치 항목이 있으면 2차 라운드 진행:

```
각 CLI에게:
  "다음은 다른 두 분석가의 결론입니다:
   분석가 A: {other_1.recommendation} — 근거: {other_1.reasoning}
   분석가 B: {other_2.recommendation} — 근거: {other_2.reasoning}

   당신의 원래 입장: {own.recommendation}

   다른 분석가의 논거를 검토한 후:
   1. 수용할 점이 있으면 입장을 수정하세요
   2. 반박할 점이 있으면 근거를 제시하세요
   3. 최종 추천을 다시 제출하세요"
```

### Step 5: 최종 종합

```
Claude Opus가 전체 토론을 종합하여 최종 보고서 작성:

## 토론 결과: {topic}

### 합의 사항 (Consensus Score: {score}%)
- [항목 1] — 3/3 합의
- [항목 2] — 2/3 합의 (반대: {dissenter} — 근거: {reason})

### 최종 추천
{recommendation}

### 근거 (3자 종합)
{synthesized_reasoning}

### 리스크 및 완화 방안
{risks_and_mitigations}

### 불일치 (해소되지 않은 항목)
{unresolved_disputes — if any}
```

## 토큰 예산

| 단계 | 토큰 |
|------|------|
| Step 2 (3x 독립) | ~15K |
| Step 3 (교차검증) | ~2K |
| Step 4 (토론, 필요시) | ~8K |
| Step 5 (종합) | ~3K |
| **총합** | **20-28K** |

## 사용 예

```
/tfx-debate "우리 서비스에 Redis vs PostgreSQL LISTEN/NOTIFY for real-time events"
/tfx-debate "모노레포 vs 멀티레포 for our 3-service architecture"
/tfx-debate "이 함수를 리팩터링할 때 Strategy 패턴 vs 단순 switch-case"
```

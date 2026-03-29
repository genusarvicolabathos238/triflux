---
name: tfx-panel
description: Deep 가상 전문가 패널 시뮬레이션. 주제에 맞는 전문가 5-10명을 선정하고 Claude/Codex/Gemini가 각 전문가 관점으로 토론하여 다관점 종합 결론을 도출한다.
triggers:
  - panel
  - 패널
  - 전문가 토론
  - expert panel
  - 전문가 패널
argument-hint: "<토론 주제>"
---

# tfx-panel — Virtual Expert Panel Simulation

> SuperClaude spec-panel + business-panel 오마주. 실제 전문가 5-10명의 관점을 시뮬레이션하여 다각적 분석.
> "한 사람의 시야는 좁다. 패널의 시야는 넓다."

## 용도

- 아키텍처 설계에서 다관점 검토가 필요할 때
- 기술 전략 결정 (마이그레이션, 프레임워크 선택, 인프라 전환)
- 요구사항이 모호하여 여러 전문 분야의 시각이 필요할 때
- 리팩터링 범위와 방향에 대한 전문가 합의 도출
- 비즈니스 + 기술 관점을 동시에 고려해야 할 때

## 전문가 풀

주제에 따라 5-10명을 자동 선정한다. 고정 풀이 아니라 주제 맥락에서 최적 전문가를 결정한다.

### 기술 전문가 (예시)

| 전문가 | 전문 분야 | 관점 |
|--------|----------|------|
| Martin Fowler | 리팩터링, 패턴 | 코드 설계 품질, 기술 부채 |
| Sam Newman | 마이크로서비스 | 서비스 경계, 분산 시스템 |
| Kent Beck | TDD, XP | 테스트, 점진적 설계 |
| Gregor Hohpe | 통합 패턴 | 메시징, 이벤트 아키텍처 |
| Brendan Burns | 클라우드 네이티브 | 컨테이너, 오케스트레이션 |

### 비즈니스/전략 전문가 (예시)

| 전문가 | 전문 분야 | 관점 |
|--------|----------|------|
| Michael Porter | 경쟁 전략 | 시장 포지셔닝, 가치 사슬 |
| Karl Wiegers | 요구사항 공학 | 요구사항 완전성, 우선순위 |
| Eric Ries | 린 스타트업 | MVP, 검증된 학습 |
| Marty Cagan | 프로덕트 | 가치, 실현 가능성, 비즈니스 |

## 워크플로우

### Step 0: 패널 도메인 선택

AskUserQuestion으로 전문가 패널의 도메인을 선택받는다:

```
AskUserQuestion:
  "패널 도메인을 선택하세요:"
  1. 소프트웨어 아키텍처 (Fowler, Newman, Vernon, Evans)
  2. 보안 (OWASP, Trail of Bits, Schneier)
  3. 비즈니스 전략 (Porter, Christensen, Drucker)
  4. DevOps/SRE (Humble, Kim, Forsgren)
  5. 프론트엔드/UX (Nielsen, Cooper, Krug)
  6. 직접 구성
```

선택된 도메인에 따라 Step 1에서 해당 분야의 전문가를 우선 선정한다.
"직접 구성"을 선택하면 사용자가 전문가 이름/역할을 직접 지정할 수 있다.

### Step 1: 주제 분석 및 전문가 선정

사용자 입력에서 주제를 파싱하고, 관련 전문 분야를 식별하여 5-10명의 전문가를 선정한다.

```
입력: "우리 모놀리스를 마이크로서비스로 전환해야 할까?"
분석: {
  topic: "모놀리스 → 마이크로서비스 전환",
  domains: ["아키텍처", "운영", "조직", "비즈니스"],
  selected_experts: [
    { name: "Sam Newman", role: "마이크로서비스 아키텍트", cli: "codex" },
    { name: "Martin Fowler", role: "리팩터링 전문가", cli: "claude" },
    { name: "Gregor Hohpe", role: "통합 패턴 전문가", cli: "gemini" },
    { name: "Michael Porter", role: "전략 분석가", cli: "codex" },
    { name: "Kent Beck", role: "점진적 설계 옹호자", cli: "claude" },
    { name: "Karl Wiegers", role: "요구사항 검증자", cli: "gemini" }
  ]
}
```

모호하면 AskUserQuestion으로 주제 명확화.

### Step 2: 독립 분석 (CLI 분담, Anti-Herding)

전문가를 3개 CLI에 분배하고, 각 CLI가 담당 전문가 관점으로 독립 분석한다. **상호 결과 비공개.**

```
Claude (Agent, background):
  "당신은 {expert_1.name}({expert_1.role})과 {expert_2.name}({expert_2.role})입니다.
   주제: {topic}
   각 전문가의 고유 관점에서 분석하세요.
   JSON: { experts: [{ name, position, reasoning, concerns, recommendation, confidence }] }"

Codex (Bash, background):
  codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check \
    "당신은 {expert_3.name}과 {expert_4.name}입니다. {topic}에 대해 각 전문가 관점으로..."

Gemini (Bash, background):
  gemini -y -p \
    "당신은 {expert_5.name}과 {expert_6.name}입니다. {topic}에 대해 각 전문가 관점으로..."
```

### Step 3: 패널 토론 시뮬레이션

3개 CLI 결과를 수집한 후, 전문가 간 교차 토론을 시뮬레이션한다:

```
Claude Opus가 패널 모더레이터 역할:

1. 각 전문가 의견 정리 (합의점 / 분쟁점 식별)
2. 분쟁점에 대해 가상 반론 생성:
   "Newman은 서비스 분리를 주장하지만, Fowler는 '모놀리스 우선'을 권고합니다.
    Newman의 반론은? Fowler의 재반론은?"
3. 2차 라운드: 반론을 반영한 수정 의견 도출
```

### Step 4: 합의 종합

```
tfx-consensus 프로토콜 적용:

전문가별 최종 입장 교차검증:
  - 과반(50%+) 합의 → "패널 합의"
  - 소수 의견 → "소수 견해" (근거 포함)
  - 대립 → "미해결 쟁점" (양측 근거 병기)
```

### Step 5: 최종 패널 보고서

```markdown
## 전문가 패널 보고서: {topic}

### 패널 구성
| # | 전문가 | 역할 | 핵심 입장 |
|---|--------|------|----------|
| 1 | Sam Newman | 마이크로서비스 아키텍트 | 점진적 분리 찬성 |
| 2 | Martin Fowler | 리팩터링 전문가 | 모놀리스 우선 정리 |
| ... | ... | ... | ... |

### 패널 합의 (Consensus Score: {score}%)
- [합의 1] — {N}/{total} 합의
- [합의 2] — {N}/{total} 합의

### 소수 견해
- {expert}: {dissenting_view} — 근거: {reason}

### 핵심 추천
{패널 종합 추천}

### 리스크 및 완화 방안
{전문가들이 식별한 리스크와 대응책}

### 미해결 쟁점
{패널 내 해소되지 않은 논쟁}

### 다음 단계 (Action Items)
1. {action_1}
2. {action_2}
```

## 토큰 예산

| 단계 | 토큰 |
|------|------|
| Step 1 (주제 분석 + 선정) | ~2K |
| Step 2 (3x 독립 분석) | ~15K |
| Step 3 (패널 토론) | ~8K |
| Step 4 (합의 종합) | ~2K |
| Step 5 (보고서) | ~3K |
| **총합** | **~30K** |

## 사용 예

```
/tfx-panel "우리 모놀리스를 마이크로서비스로 전환해야 할까?"
/tfx-panel "React vs Svelte vs Solid for our next frontend"
/tfx-panel "이 레거시 시스템의 리팩터링 전략"
/tfx-panel "B2B SaaS 가격 모델: 사용량 기반 vs 티어 기반"
```

---
name: tfx-deep-research
description: "기술 비교, 아키텍처 조사, 경쟁사 분석 등 깊이 있는 리서치가 필요할 때 사용한다. '심층 조사', '자세히 알아봐', 'deep research', '전면 리서치', '비교 분석 보고서', '종합 리서치' 같은 요청에 반드시 사용. 단순 검색이 아닌 멀티소스 교차검증이 필요한 리서치에 적극 활용."
triggers:
  - deep research
  - 딥 리서치
  - 심층 리서치
  - deep-research
  - thorough research
  - 깊이 조사
  - 전면 리서치
argument-hint: "[--depth quick|standard|deep] <리서치 주제>"
---

# tfx-deep-research — Multi-Source Deep Research with Tri-CLI Consensus

> 쿼리 분해 → 3-CLI 독립 병렬 검색 → 교차검증 → 합의 기반 종합 보고서.
> STORM(Stanford) perspective-guided + GPT-Researcher recursive tree + Tavily deep research pipeline 영감.

## 용도

- 기술 선택 전 심층 조사
- 경쟁사/대안 분석
- 새 도메인 학습을 위한 종합 리서치
- 아키텍처 결정 근거 수집
- 학술/산업 동향 파악

## Depth 모드

| 모드 | 서브쿼리 | 소스/쿼리 | 라운드 | 토큰 | 시간 |
|------|---------|----------|--------|------|------|
| quick | 3개 | 2 | 1 | ~20K | 2-3분 |
| standard | 5개 | 3 | 1-2 | ~40K | 5-8분 |
| deep | 8-10개 | 5 | 2-3 | ~80K | 10-15분 |

기본값: standard

## 워크플로우

### Pre-Phase: Depth 선택 (--depth 미지정 시)

`--depth` 플래그가 지정되지 않은 경우, AskUserQuestion으로 depth를 선택받는다:

```
AskUserQuestion:
  "리서치 깊이를 선택하세요:"
  1. quick (3 서브쿼리, ~20K 토큰, 2-3분)
  2. standard (5 서브쿼리, ~40K 토큰, 5-8분) [기본]
  3. deep (8-10 서브쿼리, ~80K 토큰, 10-15분)
```

사용자가 선택하지 않고 빈 응답을 보내면 기본값 `standard`를 적용한다.

### Phase 0: 주제 분석 및 쿼리 분해

Claude Opus가 주제를 분석하고 서브쿼리로 분해한다:

```
입력: "2026년 실시간 데이터 파이프라인 아키텍처 비교"

분해 결과:
{
  "main_topic": "실시간 데이터 파이프라인 아키텍처 2026",
  "sub_queries": [
    "Apache Kafka vs Apache Pulsar vs Redpanda 2026 comparison benchmark",
    "real-time data pipeline architecture patterns 2026 stream processing",
    "Apache Flink vs Spark Structured Streaming vs RisingWave 2026",
    "real-time data pipeline cloud managed services AWS Kinesis GCP Dataflow Azure Event Hub",
    "real-time CDC change data capture Debezium alternatives 2026"
  ],
  "perspectives": [
    "성능/처리량 관점",
    "운영 복잡도/DevOps 관점",
    "비용/스케일링 관점"
  ]
}
```

### Phase 1: 3-CLI 독립 병렬 검색 (Anti-Herding)

**3개 CLI가 동시에, 서로의 결과를 보지 않고 검색한다.**

각 CLI에 서로 다른 MCP + 관점을 할당:

```
Claude (Agent, background):
  - MCP: Exa (neural semantic search)
  - 관점: 학술/기술 깊이 (논문, 공식 문서, 벤치마크)
  - 각 서브쿼리를 Exa web_search_exa로 검색
  - category: "research paper" 우선
  - highlights 추출, numResults: 5/쿼리

> **MANDATORY: Codex/Gemini 검색은 headless dispatch로 실행**

Codex (Brave Search) + Gemini (Tavily) — Bash (background, headless dispatch):
  Bash("tfx multi --teammate-mode headless --auto-attach --dashboard \
    --assign 'codex:다음 서브쿼리를 Brave Search로 검색하고 결과를 종합하라:
   {sub_queries}
   관점: 실용/구현/산업 사례 중심
   각 쿼리당 상위 5개 결과의 제목, URL, 핵심 내용을 추출하라.:researcher' \
    --assign 'gemini:다음 서브쿼리를 Tavily로 검색하라:
   {sub_queries}
   관점: 비용/운영/DX(개발자 경험) 중심
   각 결과를 구조화하여 정리하라.:researcher' \
    --timeout 600")
```

### Phase 2: 결과 수집 및 교차검증

3개 CLI 결과를 수집한 후 tfx-consensus 프로토콜 적용:

```
교차검증 항목:
  1. 사실 일치 (3개 소스가 동일 사실을 보고하는가)
  2. 추천 일치 (동일 기술/접근법을 추천하는가)
  3. 수치 일치 (벤치마크, 가격, 성능 수치)
  4. 리스크 일치 (동일 위험을 식별하는가)

소스 신뢰도:
  - 공식 문서/벤치마크 → weight 1.0
  - 학술 논문 → weight 0.9
  - 신뢰 블로그 (engineering blog) → weight 0.7
  - 일반 블로그/포럼 → weight 0.5
  - 날짜 가중: 6개월 이내 ×1.0, 1년 이내 ×0.8, 2년 이내 ×0.5
```

### Phase 3: 합의 종합 보고서 생성

Claude Opus가 교차검증된 결과를 종합하여 최종 보고서 작성:

```markdown
# Deep Research Report: {topic}
**Date**: {date} | **Depth**: {depth} | **Consensus Score**: {score}%
**Sources**: {total_sources}개 | **Sub-queries**: {count}개

## Executive Summary
{3-5줄 핵심 요약}

## 핵심 발견사항 (Consensus Items)
### 1. {finding_1} — 합의도: {3/3 또는 2/3}
{상세 내용 + 근거 + 출처}

### 2. {finding_2}
...

## 비교 분석
| 항목 | 옵션A | 옵션B | 옵션C |
|------|-------|-------|-------|
| 성능 | ... | ... | ... |
| 비용 | ... | ... | ... |
| 운영 | ... | ... | ... |

## 미합의 사항 (Disputed Items)
- {항목}: Claude는 X, Codex는 Y, Gemini는 Z — 이유: ...

## 추천
{교차검증된 최종 추천 + 조건부 판단 기준}

## 소스 목록
1. [{title}]({url}) — 신뢰도: {score} — 사용 MCP: {exa|brave|tavily}
...
```

### Phase 4: Recursive Depth (deep 모드 전용)

deep 모드에서는 Phase 2에서 발견된 중요 하위 주제에 대해 재귀적으로 Phase 1-3을 반복:

```
if depth == "deep" AND Phase 2에서 중요 하위 주제 발견:
  for each important_subtopic (max 3):
    recurse Phase 1-3 with sub_queries = [subtopic-specific queries]
  merge recursive results into main report
```

## 토큰 예산

| 단계 | quick | standard | deep |
|------|-------|----------|------|
| Phase 0 (분해) | 1K | 2K | 3K |
| Phase 1 (3x검색) | 9K | 18K | 30K |
| Phase 2 (교차검증) | 3K | 5K | 8K |
| Phase 3 (보고서) | 5K | 10K | 15K |
| Phase 4 (재귀) | — | — | 24K |
| **총합** | **~18K** | **~35K** | **~80K** |

## MCP 활용 전략 (Exa/Brave/Tavily 리버스엔지니어링 기반)

### Exa 최적 활용
- `type: "auto"` — neural+keyword 하이브리드
- `category: "research paper"` — 학술 검색 시
- `highlights: true, text.maxCharacters: 300` — 토큰 효율 핵심
- `includeDomains` — 신뢰 도메인 필터링

### Brave 최적 활용
- `brave_news_search` — 최신 동향/뉴스
- `freshness: "pw"` (past week) — 최신성 보장
- `result_filter: "web"` — 불필요한 결과 방지
- 독립 인덱스 → Google/Bing과 다른 결과

### Tavily 최적 활용
- `tavily_search` — 빠른 범용 검색
- `include_raw_content: false` — 토큰 절약
- `max_results: 5` — 적정 결과 수
- `search_depth: "advanced"` — standard 모드 이상

## 사용 예

```
/tfx-deep-research "2026 실시간 데이터 파이프라인 아키텍처 비교"
/tfx-deep-research --depth deep "Claude Code vs Cursor vs Windsurf 멀티에이전트 지원 비교"
/tfx-deep-research --depth quick "pnpm vs bun vs npm 2026 벤치마크"
```

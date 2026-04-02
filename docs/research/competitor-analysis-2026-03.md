# triflux 경쟁 서비스 분석 보고서

> **작성일**: 2026-03-27
> **목적**: 기술 체리피킹 + 리버스 엔지니어링 기반 기술 발전 방향 도출
> **범위**: EN/CN/RU/JP 4개 언어권, 2025~2026년 출시 서비스
> **조사 규모**: 55+ 프로젝트 식별, 중복 제거 후 30개 프로파일링

---

## 1. 시장 키워드 매트릭스

### 1.1 효과적 키워드 (언어별)

| 카테고리 | EN | CN | RU | JP |
|---------|----|----|----|----|
| 직접 경쟁 | Claude Code plugin orchestration | Claude Code 插件/扩展 | плагин Claude Code | Claude Codeプラグイン |
| 멀티모델 | multi-LLM routing CLI | 多LLM路由 大模型编排 | маршрутизация LLM | マルチLLMルーティング |
| 에이전트 | multi-agent swarm framework | 多智能体框架 CLI | рой агентов | マルチエージェントフレームワーク |
| 코딩 도구 | agentic coding CLI terminal | AI终端工具 多模型 | AI CLI оркестратор | CLIコーディングエージェント |
| 오케스트레이션 | AI CLI orchestrator | AI智能体编排 | оркестрация AI агентов | AIエージェントオーケストレーション |

### 1.2 검색 인사이트

- **EN**: "Claude Code plugin" + "orchestration"이 가장 직접적. "multi-agent swarm"이 Ruflo/GSD 계열 발견에 유효
- **CN**: 중국 빅테크 CLI 도구(Qwen/Kimi/Trae/CodeBuddy)는 "AI终端工具"로 발견. Claude Code 직접 접근 불가로 플러그인 생태계 미형성
- **RU**: 러시아 원산 CLI 오케스트레이터 0건. Habr/vc.ru는 글로벌 도구 소개 채널 역할. RU 섹션에 등장하는 도구는 모두 [글로벌] 프로젝트임
- **JP**: Zenn/Qiita가 핵심 정보원. "CLI型コーディングエージェント" 전망 기사가 유효

---

## 2. 경쟁 서비스 기술 아키텍처 분석

### 2.1 Tier 1: 직접 경쟁자 (Claude Code 플러그인 + 멀티 CLI 오케스트레이션)

#### claude-octopus (GitHub Stars: ~2,100, 라이선스: MIT)
```
[아키텍처]
Claude Code Plugin
  └─ 8 Provider Adapters (Codex, Gemini, Claude, Perplexity, OpenRouter, Copilot, Qwen, Ollama)
  └─ 32 Personas (전문 에이전트 역할)
  └─ Double Diamond Workflow (Discover→Define→Develop→Deliver)
  └─ 75% Consensus Gate (다수결 품질 게이트)
  └─ Reaction Engine (CI 실패 자동 대응)
  └─ 47 Commands, 50 Skills
```
- **핵심 기술**: 합의 기반 품질 게이트, 적대적 리뷰 워크플로우
- **triflux 대비**: 8개 프로바이더(triflux: 3개), 합의 게이트(triflux: 없음). 단, WT/psmux 분할 창 관리 없음, HUD 없음

#### Ruflo (구 claude-flow) (GitHub Stars: ~26,700)
```
[아키텍처]
Claude Code Native Integration
  └─ SONA Self-Learning Router (신경망 기반 자율 라우팅)
  └─ 60+ Specialized Agents
  └─ 313 MCP Tools
  └─ Swarm Intelligence (fault-tolerant consensus)
  └─ RAG Pipeline
  └─ Codex CLI Integration (2차 런타임)
```
- **핵심 기술**: 자가 학습 신경망 라우팅(SONA), SWE-bench 84.8%
- **triflux 대비**: 에이전트 규모(60+ vs ~20), MCP 도구 수(313 vs ~10). 단, Gemini CLI 미통합, Windows 미지원

#### Claude-Code-Workflow (JP 발견)
```
[아키텍처]
JSON-Driven Orchestration Config
  └─ Multi-CLI Backend (Gemini CLI + Qwen + Codex CLI)
  └─ Context-First Design (컨텍스트 우선 전달)
  └─ Claude Code Plugin Interface
```
- **핵심 기술**: JSON 기반 선언적 워크플로우 정의
- **triflux 대비**: 설계 사상이 가장 유사 (3개 CLI 오케스트레이션). 단, 규모/기능 소형

#### Overstory (GitHub Stars: 미확인, 라이선스: MIT)
```
[아키텍처]
TypeScript/Bun Runtime
  └─ 11 Pluggable Runtimes (Claude Code, Gemini CLI, Aider, Goose, Amp, ...)
  └─ Git Worktree Isolation (에이전트당 독립 워크트리)
  └─ tmux Worker Spawning
  └─ SQLite Mail Bus (~1-5ms/query 에이전트 간 통신)
  └─ Tiered Conflict Resolution
```
- **핵심 기술**: Git worktree 기반 에이전트 격리, SQLite 메일 버스
- **triflux 대비**: 11개 런타임(triflux: 3개), worktree 격리(triflux: psmux pane). 단, HUD 없음, Windows 미지원

#### myclaude (RU 발견, GitHub Stars: ~2,500)
```
[아키텍처]
2-Layer Architecture
  └─ Orchestrator Layer (작업 분해 + 라우팅)
  └─ Executor Layer (Codex/Claude/Gemini/OpenCode 백엔드)
  └─ 11 Commands, 5 Modules
```
- **핵심 기술**: 깔끔한 오케스트레이터/실행기 분리 아키텍처
- **triflux 대비**: 아키텍처 분리가 명확. AGPL-3.0 + 상업 라이선스 모델

#### claude_code_bridge (CCB) (GitHub Stars: ~1,900)
```
[아키텍처]
Split-Screen Terminal (WezTerm/tmux)
  └─ Per-AI Independent Memory
  └─ True Parallelism (진정한 병렬 실행)
  └─ Daemon-Based Async
  └─ WYSIWYG Philosophy ("모든 것을 보고, 모든 것을 제어")
```
- **핵심 기술**: WezTerm 분할 화면 + 에이전트별 독립 메모리
- **triflux 대비**: WezTerm 사용(triflux: Windows Terminal + psmux). "WYSIWYG" 철학이 triflux의 HUD와 유사한 목적

### 2.2 Tier 2: 대형 플레이어

#### everything-claude-code (GitHub Stars: ~111,000)
```
[아키텍처]
Claude Code Mega-Plugin
  └─ 28 Specialized Agents
  └─ 125+ Skills, 60+ Commands
  └─ DevFleet (병렬 worktree 에이전트)
  └─ NanoClaw v2 (모델 라우팅 + 스킬 핫로드)
  └─ AgentShield (6계층 보안)
  └─ Cross-Harness (Claude Code/Cursor/OpenCode/Codex/Antigravity)
```
- **핵심 기술**: NanoClaw v2 (스킬 핫로드 + 동적 모델 라우팅), AgentShield 보안 프레임워크
- **triflux 대비**: 생태계 최대 규모(111k stars). Anthropic 해커톤 1위. 그러나 CLI 오케스트레이션보다 플러그인 생태계 중심

#### GSD / Get-Shit-Done (GitHub Stars: ~32,000)
```
[아키텍처]
Meta-Prompting + Context Engineering
  └─ Multi-Runtime (Claude Code, OpenCode, Gemini CLI, Codex, Copilot)
  └─ "Fresh Brain" Context Isolation (작업별 컨텍스트 격리)
  └─ Spec-Driven Development
  └─ Rollback/Recovery (GSD 2.0)
```
- **핵심 기술**: 컨텍스트 격리 + 메타 프롬프팅 규율
- **triflux 대비**: 프롬프트 엔지니어링 레이어(triflux: 인프라 레이어). 다른 추상화 수준

#### AWS CLI Agent Orchestrator (CAO) (GitHub Stars: ~353)
```
[아키텍처]
AWS Labs Official
  └─ 7 CLI Support (Kiro, Claude Code, Codex, Gemini, Kimi, Copilot, Q CLI)
  └─ Hierarchical Supervisor + Worker Agents
  └─ tmux Session Isolation
  └─ MCP Inter-Agent Communication
  └─ 3 Patterns: Handoff, Assign (async), Send Message
  └─ Crontab-style Scheduling (beta)
  └─ REST API
```
- **핵심 기술**: 계층형 수퍼바이저 패턴, crontab 스케줄링, 7개 CLI 통합
- **triflux 대비**: AWS 공식 지원, 가장 많은 CLI 지원(7개). 단, Linux/macOS 전용(tmux), HUD 없음

### 2.3 Tier 3: 중국 빅테크 CLI 에이전트

| 서비스 | 회사 | 핵심 기술 | GitHub Stars |
|--------|------|----------|-------------|
| **Qwen Code** | Alibaba | Gemini CLI 포크, 1M 컨텍스트, Qwen3-Coder, SubAgents | OSS (Apache 2.0) |
| **Kimi Code CLI** | Moonshot AI | Agent 클러스터 협업, ACP 프로토콜, 256K 컨텍스트 | OSS |
| **Trae Agent** | ByteDance | SWE-bench SOTA, 3 실행 모드, 다중 모델 | MIT |
| **CodeBuddy CLI** | Tencent | --agents 커스텀 Sub-Agent JSON, DeepSeek 무제한 | 베타 |
| **Baidu Comate/Zulu** | Baidu | 멀티모달 입력(음성/이미지/다이어그램), 에이전트 군집 | 기업 SaaS |

### 2.4 Tier 4: 상업 플랫폼

| 서비스 | 유형 | 핵심 기술 | 가격 |
|--------|------|----------|------|
| **GitHub Copilot CLI** | MS/GitHub | /fleet 서브에이전트, 4전문에이전트, 멀티모델 | $10/mo |
| **Warp ADE** | 상업 터미널 | Oz 클라우드 에이전트, cron/Slack/GitHub 트리거 | $0~$180/mo |
| **Amp** | Sourcegraph | smart/rush/deep 3모드, Oracle/Librarian 서브에이전트 | $10/일 무료 |
| **Devin** | Cognition AI | 클라우드 VM 샌드박스, 완전 자율 | $20/mo + $2.25/ACU |

---

## 3. 기술 체리피킹 매트릭스

### 3.1 즉시 도입 가치 (P0 - 높은 가치, 낮은 난이도)

| 기술 | 출처 | 구현 난이도 | 기대 효과 | 리버스 엔지니어링 가능성 |
|------|------|-----------|----------|---------------------|
| **합의 기반 품질 게이트** | claude-octopus | M | 코드 품질 향상, 할루시네이션 감소 | HIGH (OSS, 로직 공개) |
| **JSON 선언적 워크플로우** | Claude-Code-Workflow | L | 사용자 정의 파이프라인 편의성 | HIGH (OSS) |
| **CLI-to-API 변환 레이어** | CLIProxyAPI | M | OAuth 기반 무료 모델 접근 확대 | HIGH (OSS, Go SDK) |
| **스킬 핫로드** | everything-claude-code (NanoClaw v2) | M | 런타임 스킬 추가/제거 | MEDIUM (코드 공개, 복잡) |

### 3.2 중기 도입 (P1 - 높은 가치, 중간 난이도)

| 기술 | 출처 | 구현 난이도 | 기대 효과 |
|------|------|-----------|----------|
| **자가 학습 라우팅 (SONA)** | Ruflo | H | 에이전트 라우팅 최적화 자동화 |
| **Git Worktree 에이전트 격리** | Overstory, ComposioHQ | M | 병렬 에이전트 파일 충돌 제거 |
| **SQLite 메일 버스** | Overstory | M | 에이전트 간 저지연 통신 |
| **적대적 리뷰 워크플로우** | claude-octopus | M | 코드 리뷰 품질 극대화 |
| **crontab 스케줄링** | AWS CAO | M | 주기적 자동 작업 실행 |

### 3.3 장기 관찰 (P2 - 전략적 가치)

| 기술 | 출처 | 관찰 이유 |
|------|------|----------|
| **멀티모달 입력** | Baidu Comate | 음성/이미지/다이어그램 → 코드 생성, 아직 초기 |
| **DevFleet 패턴** | everything-claude-code | 대규모 병렬 worktree 에이전트, 생태계 규모 필요 |
| **클라우드 에이전트** | Warp Oz, Devin | 로컬 CLI에서 클라우드 하이브리드로 전환 트렌드 |
| **ACP 프로토콜** | Kimi CLI | Agent Client Protocol — MCP의 차세대 가능성 |
| **Agent Skills (.agent.md)** | GitHub Copilot CLI | 에이전트별 역할 정의 표준화 |

---

## 4. 리버스 엔지니어링 인사이트

### 4.1 claude-octopus: 합의 게이트 구현 패턴

```
[추정 구현]
1. N개 에이전트에 동일 작업 병렬 할당
2. 각 에이전트 결과를 구조화된 형태로 수집
3. 결과 간 diff/similarity 계산
4. 75% 이상 합의 시 통과, 미달 시 재작업

[triflux 적용]
- hub/pipeline/gates/consensus.mjs로 합의 게이트 추가 (기존 confidence/selfcheck 게이트와 병행)
- verifier + code-reviewer 결과를 교차 검증
- 합의율 임계값을 설정 가능하게 구현
```

### 4.2 Ruflo SONA: 자가 학습 라우팅

```
[추정 구현]
1. 작업 특성 벡터화 (코드 타입, 복잡도, 언어)
2. 과거 라우팅 결과 기반 성공률 테이블
3. 신경망 또는 통계 모델로 최적 에이전트 예측
4. 피드백 루프: 작업 성공/실패로 가중치 업데이트

[triflux 적용]
- agent-map.json을 정적 매핑 → 동적 가중치 매핑으로 확장
- 작업 결과 로그 수집 → 라우팅 히트맵 생성
- 1단계: 통계 기반 (성공률 추적)
- 2단계: ML 기반 (작업 특성 → 에이전트 예측)
```

### 4.3 Overstory: SQLite 메일 버스

```
[추정 구현]
SQLite DB (single file)
  ├── messages (id, from, to, type, payload, timestamp, read)
  └── cursors (agent_id, last_read_id)

- 에이전트가 주기적으로 SELECT WHERE id > cursor
- ~1-5ms/query (SQLite WAL 모드)
- 파일 기반이므로 tmux/psmux 크로스 세션 통신 가능

[triflux 적용]
- 현재 SendMessage (Claude Code 네이티브) 의존
- SQLite 메일 버스를 보조 채널로 추가
- CLI 워커(Codex/Gemini)가 네이티브 메시징 불가 → SQLite로 대체
```

### 4.4 CCB: 에이전트별 독립 메모리

```
[추정 구현]
각 AI 세션마다 독립 컨텍스트 파일:
  ~/.ccb/sessions/
    ├── codex-session-001.json  (Codex 작업 히스토리)
    ├── gemini-session-001.json (Gemini 작업 히스토리)
    └── claude-session-001.json (Claude 작업 히스토리)

- 세션 간 컨텍스트 오염 방지
- 필요 시 선택적 컨텍스트 공유 (명시적 inject)

[triflux 적용]
- headless.mjs의 contextFile 옵션을 세션별 컨텍스트 스토어로 확장
- 에이전트별 히스토리 누적 → 동일 에이전트 재실행 시 이전 컨텍스트 주입
```

### 4.5 CLIProxyAPI: CLI-to-API 변환

```
[추정 구현]
Go HTTP 서버
  └─ /v1/chat/completions (OpenAI 호환)
  └─ 내부: CLI 프로세스 spawn → stdout 캡처 → JSON 응답 변환
  └─ 라운드로빈 로드 밸런싱 (복수 CLI 인스턴스)
  └─ OAuth 기반 인증

[triflux 적용]
- hub/server.mjs의 MCP 엔드포인트를 OpenAI 호환 API로 확장
- 외부 도구(Cursor, Aider 등)에서 triflux를 API로 호출 가능
- CLI 실행 결과를 스트리밍 응답으로 변환
```

---

## 5. triflux 포지셔닝 분석

### 5.1 triflux만의 고유 차별점 (경쟁 불가 영역)

| 차별점 | 가장 근접한 경쟁자 | 차이 |
|--------|------------------|------|
| **Windows Terminal + psmux 네이티브 통합** | CCB (WezTerm) | CCB는 WezTerm/tmux, triflux는 WT+psmux 전용 |
| **HUD 대시보드 (실시간 상태 시각화)** | Warp ADE | Warp는 별도 터미널 앱, triflux는 CLI 플러그인 |
| **OMC 기반 + 외부 3 CLI 오케스트레이션** | claude-octopus (8 providers) | octopus는 API 레벨, triflux는 CLI 프로세스 직접 제어 |
| **한국어 생태계 + 스킬/훅/키워드 라우팅 통합** | 없음 | 유일한 한국어 네이티브 CLI 오케스트레이터 |

### 5.2 경쟁 열위 영역 (개선 필요)

| 영역 | 선두 주자 | triflux 현재 | 격차 |
|------|----------|-------------|------|
| 지원 프로바이더 수 | claude-octopus (8개) | 3개 (Claude/Codex/Gemini) | -5 |
| 에이전트 수 | Ruflo (60+) | ~20 | -40 |
| MCP 도구 수 | Ruflo (313) | ~10 | -300 |
| GitHub Stars | everything-claude-code (111k) | ~0 (비공개 → 공개 전환 필요?) | - |
| 자가 학습 라우팅 | Ruflo (SONA) | 정적 agent-map.json | 세대 차이 |
| 품질 게이트 | claude-octopus (75% 합의) | hub/pipeline/gates/confidence.mjs (5-criteria, 90/70 임계값) + selfcheck.mjs (7 할루시네이션 red flags) | 합의 게이트 추가 필요 |
| Linux/macOS 지원 | 대부분 경쟁자 | Windows 전용 | 플랫폼 제한 |

> **기존 인프라 인정**: triflux는 이미 `hub/pipeline/gates/confidence.mjs` (5-criteria 평가, 90/70 임계값)와 `hub/pipeline/gates/selfcheck.mjs` (7가지 할루시네이션 red flags 검사)를 보유하고 있다. "품질 게이트 없음"이 아닌, 합의(consensus) 게이트가 추가로 필요한 상태임.

### 5.3 시장 포지션 매트릭스

```
                    CLI 프로세스 직접 제어
                         │
        triflux ●        │        ● CCB
                         │
  ─────────────────────────────────────────
  단일 모델              │              멀티 모델
                         │
        Ruflo ●          │     ● claude-octopus
                         │
                    API/프록시 레벨
                         │
             ● OpenRouter │   ● CLIProxyAPI
```

---

## 6. 기술 로드맵 시사점

### 6.1 단기 (v7.3~v7.5): 체리피킹 우선순위

1. **합의 기반 품질 게이트** (claude-octopus)
   - hub/pipeline/gates/consensus.mjs로 합의 게이트 추가 (기존 confidence/selfcheck 게이트와 병행)
   - N개 리뷰어 결과 교차 검증, 합의율 임계값 설정 가능 (기본 66%)
   - 예상 효과: 코드 품질 20-30% 향상

2. **JSON 선언적 워크플로우** (Claude-Code-Workflow)
   - `.tfx-workflow.json`으로 커스텀 파이프라인 정의
   - 에이전트 체인, 조건 분기, 병렬 실행 선언적 구성
   - 예상 효과: 반복 워크플로우 설정 시간 80% 단축

3. **에이전트별 세션 컨텍스트** (CCB)
   - headless 실행 시 에이전트별 히스토리 저장/주입
   - 동일 작업 연속 실행 시 이전 맥락 자동 전달

### 6.2 중기 (v8.x): 아키텍처 확장

4. **동적 라우팅 엔진** (Ruflo SONA 경량화)
   - agent-map.json → 가중치 기반 동적 매핑
   - 작업 성공률 추적 → 자동 라우팅 최적화
   - 1단계: 통계 기반, 2단계: ML 기반

5. **Git Worktree 에이전트 격리** (Overstory)
   - 병렬 에이전트 파일 충돌 근본 해결
   - psmux pane + worktree 매핑

6. **프로바이더 확장** (claude-octopus)
   - Perplexity, OpenRouter, Ollama 어댑터 추가
   - 3 → 6+ CLI 지원

### 6.3 장기 (v9.x): 전략적 방향

7. **크로스 플랫폼** (Linux/macOS tmux 지원)
8. **OpenAI 호환 API 엔드포인트** (CLIProxyAPI)
9. **클라우드 하이브리드 모드** (Warp Oz 참조)

---

## 7. 위협 분석

### 7.1 즉각적 위협

| 위협 | 심각도 | 대응 방안 |
|------|--------|----------|
| **GitHub Copilot CLI GA** (2026-02) | HIGH | /fleet 패턴 분석, triflux만의 Opus 품질 강조 |
| **Ruflo 26.7k stars 생태계 잠식** | HIGH | 기능 차별화(WT/psmux/HUD), 한국어 생태계 강화 |
| **claude-octopus 8 프로바이더** | MEDIUM | 프로바이더 확장 로드맵 가속 |

### 7.2 중기 위협

| 위협 | 심각도 | 대응 방안 |
|------|--------|----------|
| **중국 빅테크 CLI 도구 확산** (Qwen/Trae/CodeBuddy) | MEDIUM | 글로벌 시장 집중, 중국 시장은 관찰 |
| **Warp ADE Windows 확대** | MEDIUM | HUD + psmux 네이티브 통합 심화 |
| **everything-claude-code 111k stars** | LOW | 다른 레이어 (플러그인 생태계 vs CLI 오케스트레이션) |

---

## 8. 부록: 전체 경쟁 서비스 목록

### A. EN (영어권) — 15개

| # | 서비스 | 유사도 | Stars | 핵심 특징 |
|---|--------|--------|-------|----------|
| 1 | claude-octopus | HIGH | 2.1k | 8 providers, 합의 게이트 |
| 2 | oh-my-claudecode | HIGH | 8.5k | triflux 기반 프레임워크 |
| 3 | Ruflo | HIGH | 26.7k | SONA 자가학습, 313 MCP |
| 4 | GSD | MED-HIGH | 32k | 메타 프롬프팅, 컨텍스트 격리 |
| 5 | GSD Pro | MED-HIGH | - | GSD 포크, 멀티모델 |
| 6 | Overstory | MED-HIGH | - | 11 런타임, worktree, SQLite |
| 7 | ComposioHQ | MEDIUM | - | CI/CD fix loop |
| 8 | AWS CAO | MEDIUM | 353 | 7 CLI, 수퍼바이저 패턴 |
| 9 | GitHub Copilot CLI | MEDIUM | - | /fleet, GA 2026-02 |
| 10 | Warp ADE | MEDIUM | - | Oz 클라우드 에이전트 |
| 11 | Aider | LOW-MED | 39k | 단일 에이전트, git-first |
| 12 | OpenCode | LOW-MED | ~95-120k (변동) | Go TUI, 75+ providers |
| 13 | Cline | LOW | 48k | VS Code 확장 |
| 14 | Devin | LOW | - | 클라우드 VM 자율 에이전트 |
| 15 | CC Plugins Marketplace | MEDIUM | - | 340 plugins, 1367 skills |

### B. CN (중국어권) — 9개

| # | 서비스 | 유사도 | 회사 | 핵심 특징 |
|---|--------|--------|------|----------|
| 1 | Claude Code Router | HIGH | 개인 | HTTP 프록시, 4역할 라우팅 |
| 2 | Qwen Code | HIGH | Alibaba | Gemini CLI 포크, 1M ctx |
| 3 | Kimi Code CLI | HIGH | Moonshot | Agent 클러스터, ACP |
| 4 | Trae Agent | MEDIUM | ByteDance | SWE-bench SOTA |
| 5 | CodeBuddy CLI | MEDIUM | Tencent | Sub-Agent JSON |
| 6 | Baidu Comate | MEDIUM | Baidu | 멀티모달 입력 |
| 7 | MGX/MetaGPT X | MEDIUM | DeepWisdom | 5 직군 에이전트 |
| 8 | Dify | LOW | LangGenius | 웹 기반 노코드 |
| 9 | OpenCode | LOW | ~95-120k (변동) | Go TUI, 75+ providers |

### C. RU (러시아어권) — 13개

> **참고**: 러시아 원산 CLI 오케스트레이터 0건. 아래 목록은 Habr/vc.ru 등 RU 미디어에서 소개된 도구로, 대부분 [글로벌] 프로젝트임.

| # | 서비스 | 유사도 | Stars | 핵심 특징 |
|---|--------|--------|-------|----------|
| 1 | claude-octopus [글로벌] | 9/10 | 2.1k | 8 providers, 합의 게이트 |
| 2 | myclaude | 8/10 | 2.5k | 오케스트레이터/실행기 분리 |
| 3 | claude_code_bridge | 8/10 | 1.9k | WezTerm 분할, 독립 메모리 |
| 4 | everything-claude-code [글로벌] | 7/10 | 111k | NanoClaw, DevFleet, AgentShield |
| 5 | claude-skills [글로벌] | 5/10 | 5.2k | 205 스킬, 11 도구 호환 |
| 6 | CC Plugins Marketplace [글로벌] | 5/10 | - | 340 plugins |
| 7 | AWS CAO [글로벌] | 5/10 | 353 | 7 CLI, AWS 공식 |
| 8 | CLIProxyAPI [글로벌] | 4/10 | 20.5k | CLI→API 변환 |
| 9 | OpenCode [글로벌] | 4/10 | ~95-120k (변동) | Go TUI |
| 10 | GitHub Copilot CLI [글로벌] | 3/10 | - | /fleet |
| 11 | Cline [글로벌] | 3/10 | 48k | VS Code |
| 12 | gemini-cli-orchestrator [글로벌] | 3/10 | 27 | Claude→Gemini MCP |
| 13 | claude-codex-gemini | 4/10 | 14 | 순차 파이프라인 |

### D. JP (일본어권) — 18개

| # | 서비스 | 유사도 | 핵심 특징 |
|---|--------|--------|----------|
| 1 | oh-my-claudecode | ★★★★★ | triflux 기반 |
| 2 | claude-forge | ★★★★ | 11 agents, 6층 보안 |
| 3 | Ruflo | ★★★★ | SONA, 60+ agents |
| 4 | oh-my-customcode | ★★★★ | 42 agents, 온톨로지 그래프 |
| 5 | Claude-Code-Workflow | ★★★★ | JSON 멀티CLI 오케스트레이션 |
| 6 | AWS CAO | ★★★★★ | 7 CLI, AWS 공식 |
| 7 | Gemini CLI | ★★★ | Google 공식, 무료 |
| 8 | Amp | ★★★ | Sourcegraph, 3모드 |
| 9 | Goose | ★★★ | Block, 벤더 비종속 |
| 10 | Overstory | ★★★★ | 11 런타임, worktree |
| 11 | OpenRouter | ★★ | API 라우터 |
| 12 | LiteLLM | ★★ | 통합 인터페이스 |
| 13 | Continue.dev | ★★ | IDE + CLI |
| 14 | Kiro | ★★ | AWS, Spec-driven |
| 15-18 | 기타 | ★~★★ | OpenCode, Copilot CLI 등 |

---

## 9. 출처

### EN
- GitHub: claude-octopus, ruflo, gsd-build, overstory, ComposioHQ, awslabs/cli-agent-orchestrator [미검증 — 실제 URL 확인 필요]
- Product: ampcode.com, warp.dev, devin.ai, cline.bot, opencode.ai
- Blog: github.blog, aws.amazon.com/blogs, tembo.io/blog

### CN
- GitHub: QwenLM/qwen-code [미검증 — 실제 URL 확인 필요], MoonshotAI/kimi-cli, bytedance/trae-agent, musistudio/claude-code-router
- Media: cnblogs.com, oschina.net, zhuanlan.zhihu.com, qbitai.com, help.apiyi.com
- Product: codebuddy.ai, comate.baidu.com, dify.ai

### RU
- GitHub: cexll/myclaude, bfly123/claude_code_bridge, affaan-m/everything-claude-code, router-for-me/CLIProxyAPI
- Media: habr.com, proglib.io

### JP
- GitHub: sangrokjung/claude-forge, catlog22/Claude-Code-Workflow, baekenough/oh-my-customcode
- Media: zenn.dev, qiita.com, sbbit.jp
- Blog: aws.amazon.com/jp, sangrok.hashnode.dev, analyticsvidhya.com

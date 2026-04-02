# triflux 경쟁 서비스 리버스 엔지니어링 보고서

> **작성일**: 2026-03-27
> **목적**: 기술 체리피킹 + 리버스 엔지니어링 기반 triflux 기술 발전
> **분석 대상**: 7개 OSS 레포, 전체 소스 코드 직접 분석
> **분석 에이전트**: 7 Opus architect 병렬 실행

---

## Executive Summary

7개 경쟁 레포의 소스 코드를 직접 분석한 결과, triflux에 **즉시 포팅 가능한 고가치 기술 4건**과 **중기 도입 가치 3건**을 식별했다.

| 순위 | 기술 | 출처 | 포팅 난이도 | 코드량 | 즉시 가치 |
|------|------|------|-----------|--------|----------|
| **P0** | Q-Learning 동적 라우팅 | ruflo | M | ~600 LoC TS | agent-map.json → 학습 기반 라우팅 |
| **P0** | 합의 품질 게이트 | claude-octopus | M | ~300 LoC bash→JS | hub/pipeline/gates/consensus.mjs 추가 (confidence/selfcheck 병행) |
| **P0** | Backend 인터페이스 패턴 | myclaude | L | ~200 LoC | CLI 백엔드 확장성 |
| **P0** | 4-tier 충돌 해결 | overstory | H | ~700 LoC | 멀티에이전트 병합 안전성 |
| P1 | SQLite 메일 버스 | overstory | M | ~400 LoC | CLI 워커 통신 |
| P1 | JSON 선언적 워크플로우 | Claude-Code-Workflow | M | ~500 LoC | 사용자 정의 파이프라인 |
| P1 | 컨텍스트 전송 파이프라인 | CCB | M | ~600 LoC | 에이전트 간 맥락 공유 |

---

## 1. claude-octopus — 합의 게이트 + 프로바이더 라우팅

### 1.1 합의 게이트 구현

**위치**: `scripts/lib/quality.sh`

```
[결정 흐름] evaluate_quality_branch() @ quality.sh:62-89

  success_rate >= 90%  →  "proceed" (통과)
  success_rate >= 75%  →  "proceed_warn" (경고 후 통과)
  < 75% + 재시도 가능  →  "retry" (최대 3회)
  < 75% + 감독 모드    →  "escalate" (사람 리뷰)
  < 75% + 기타         →  "abort" (중단)
```

**단계별 임계값** (quality.sh:189-194):
- Discover: 50%, Define: 75%, Develop: 75%, Deliver: 80%, Security: 100%

**프로바이더 잠금**: 실패 시 `lock_provider()` → `get_alternate_provider()`로 codex→gemini→claude 순환

**서킷 브레이커** (provider-router.sh:17-230):
- 에러 분류: transient(429, 5xx) vs permanent(401, 403)
- 3회 transient 실패 → 5분 쿨다운 → half-open 프로브
- 지수 백오프 (최대 60초, 지터 포함)

### 1.2 8 프로바이더 어댑터

**패턴**: bash `case` dispatch (`dispatch.sh:16-115`)
```bash
case "$provider" in
  codex*)    -> "codex exec --model ${model} --sandbox ${mode}"
  gemini*)   -> "gemini -o text --approval-mode yolo -m ${model}"
  claude)    -> "claude --print"
  openrouter)-> "openrouter_execute"
  perplexity)-> "perplexity_execute $model"
  copilot)   -> "copilot --no-ask-user"
  ollama)    -> "ollama run $model"
  qwen*)     -> "qwen -o text --approval-mode yolo"
esac
```

**자동 감지** (orchestrate.sh:1121-1215): `command -v` + 인증 파일/환경변수 존재 확인

**4가지 라우팅 전략** (provider-router.sh:261-341):
- round-robin: 파일 기반 카운터
- fastest: avg_latency_ms 최소
- cheapest: avg_cost_usd 최소
- scored: 인텔리전스 스코어 기반

### 1.3 triflux 적용안

```javascript
// hub/quality-gate.mjs
export function evaluateQualityBranch(successRate, retryCount, maxRetries = 3) {
  if (successRate >= 90) return "proceed";
  if (successRate >= 75) return "proceed_warn";
  if (retryCount < maxRetries) return "retry";
  return "abort";
}

// 서킷 브레이커: 기존 hub 라우팅에 추가
// provider-health 상태를 agent-map.json과 병행 관리
```

---

## 2. Ruflo — SONA 4-Layer 라우팅 캐스케이드

### 2.1 핵심 발견: "SONA"는 신경망이 아니다

실제 구현은 **4층 폴백 캐스케이드**:

```
Layer 1: SONA Pattern Match (키워드 매칭, 신뢰도 >= 0.6)
  ↓ miss
Layer 2: Q-Learning Router (테이블 기반 RL, epsilon-greedy)
  ↓ miss
Layer 3: MoE Router (384-dim 임베딩 → 2층 게이팅 네트워크)
  ↓ miss
Layer 4: ModelRouter (복잡도 스코어링 → haiku/sonnet/opus)
```

### 2.2 Q-Learning Router (가장 가치 있는 컴포넌트)

**위치**: `v3/@claude-flow/cli/src/ruvector/q-learning-router.ts` (~600 LoC)

- **상태 표현**: 64-dim 특성 벡터 (키워드 32 + 컨텍스트 길이 8 + 단어 수 8 + 파일 확장자 8 + n-gram 해시 8)
- **액션**: 8개 에이전트 타입 [coder, tester, reviewer, architect, researcher, optimizer, debugger, documenter]
- **업데이트**: 표준 벨만 방정식, γ=0.99
- **경험 리플레이**: 우선순위 기반, 원형 버퍼 1000, 미니배치 32
- **엡실론 감쇠**: 지수(기본), 선형, 코사인 어닐링 지원
- **LRU 캐시**: 반복 패턴 256개, TTL 5분
- **영속화**: `.swarm/q-learning-model.json`, 100회 업데이트마다 자동 저장

### 2.3 SWE-bench 84.8% 주장 → 검증 불가

벤치마크 디렉토리에 SWE-bench 통합 하네스 부재. 내부 성능 메트릭만 측정.

### 2.4 triflux 적용안: 동적 라우팅 엔진

```
triflux task
  ↓
ComplexityScorer (model-router.ts 포팅, ~200 LoC)
  ↓ score: 0-1
QLearningRouter (q-learning-router.ts 포팅, ~600 LoC)
  ↓ 5 actions: opus/codex/gemini/haiku/sonnet
agent-map.json 또는 동적 결정
  ↓
tfx-route.sh dispatch (기존)
  ↓
Outcome Feedback → QLearningRouter.update()
  ↓
.omc/routing-patterns.json (영속화)
```

**핵심**: Q-Learning Router는 외부 의존성 0, fs/path만 사용. 직접 포팅 가능.

---

## 3. Overstory — SQLite 메일 버스 + Git Worktree + 4-Tier 충돌 해결

### 3.1 SQLite 메일 버스 스키마

**위치**: `src/mail/store.ts:46-59`

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,           -- msg-{random12}
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'status'
    CHECK(type IN ('status','question','result','error',
      'worker_done','merge_ready','merged','merge_failed',
      'escalation','health_check','dispatch','assign','decision_gate')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK(priority IN ('low','normal','high','urgent')),
  thread_id TEXT,
  payload TEXT,                   -- JSON 구조화 데이터
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_inbox ON messages(to_agent, read);
CREATE INDEX idx_thread ON messages(thread_id);

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

**2-Layer API**:
- L1 `MailStore`: 준비된 문장 기반 CRUD (~1-5ms/query)
- L2 `MailClient`: `send()`, `check()` (파괴적 커서 — 읽은 후 자동 mark read), `sendProtocol<T>()` (타입 안전), `reply()` (자동 스레딩)

> **기존 인프라 주의**: triflux는 이미 `hub/store.mjs` (better-sqlite3 기반 영속 스토어)와 `hub/router.mjs` (인메모리 라우팅)를 보유하고 있다. SQLite 메일 버스 도입 시 기존 `hub/store.mjs` 확장 또는 별도 mail DB 분리 방안을 검토해야 함.

### 3.2 Git Worktree 에이전트 격리

```
경로: .overstory/worktrees/{agentName}
브랜치: overstory/{agentName}/{taskId}
```

**14단계 스폰 경로** (sling.ts):
1. 설정 로드 → 2. 깊이 제한 검증 → 3. 역량 검증 → 4. run_id 생성 → 5. 동시성 제한(25) → 6. 태스크 존재 확인 → 7. **워크트리 생성** → 8. 오버레이 명령어 파일 생성 → 9. 훅/가드 배포 → 10. 태스크 클레임 → 11. 에이전트 ID 생성 → 12. **tmux 세션 생성** → 13. 세션 기록 → 14. AgentSession 반환

**롤백**: 실패 시 `git worktree remove --force` + `git branch -D`

### 3.3 4-Tier 충돌 해결 (가장 가치 있는 컴포넌트)

**위치**: `src/merge/resolver.ts`

| Tier | 이름 | 전략 | 안전 장치 |
|------|------|------|----------|
| 1 | Clean Merge | `git merge --no-edit` | - |
| 2 | Auto-Resolve | 충돌 마커 파싱, incoming(에이전트) 유지 | `hasContentfulCanonical()` — HEAD에 실질 코드 있으면 T3으로 에스컬레이션 |
| 3 | AI-Resolve | `claude --print` 파일별 해결 | `looksLikeProse()` — AI가 코드 대신 설명문 반환 시 T4로 에스컬레이션 |
| 4 | Re-imagine | merge --abort → 양쪽 버전 AI에 전달 → 재구현 | 동일 prose 검증 |

**충돌 히스토리 학습**: mulch 스토어에 결과 기록 → 과거 2회 이상 실패한 tier 자동 스킵

### 3.4 11 런타임 플러그인

**AgentRuntime 인터페이스** (14 메서드):
```typescript
interface AgentRuntime {
  id: string;
  stability: "stable" | "beta" | "experimental";
  instructionPath: string;
  buildSpawnCommand(opts): string;
  buildPrintCommand(prompt, model?): string[];
  deployConfig(path, overlay, hooks): void;
  detectReady(paneContent): boolean;
  parseTranscript(path): TokenUsage;
  getTranscriptDir(root): string;
  buildEnv(model): Record<string, string>;
  // Optional: headless, connect, prepareWorktree
}
```

**레지스트리**: 팩토리 Map, 4-level 폴백 (명시적 → 역량별 → 기본 → "claude")

---

## 4. Claude-Code-Workflow — JSON 선언적 오케스트레이션

### 4.1 3-Tier 스키마 진화

| Tier | 파일 | 용도 |
|------|------|------|
| A | Flow graph (DAG) | 시각적 편집기, `FlowNode[]` + `FlowEdge[]` |
| B | Plan-overview + Task JSON | 에이전트 생성 계획, 파일 분할 (`TASK-*.json`) |
| C | Team-tasks | wave 기반 병렬 실행, Claude Code API 매핑 |

### 4.2 핵심 설계: 통합 prompt-template 노드

이전 6개 노드 타입(slash-command, cli-command, file-operation, conditional, parallel, prompt-template)을 **단일 `prompt-template`로 통합**.

```typescript
interface PromptTemplateNodeData {
  instruction: string;          // {{var}} 보간 지원
  tool?: "gemini" | "qwen" | "codex" | "claude";
  mode?: "analysis" | "write" | "mainprocess" | "async";
  contextRefs?: string[];       // 이전 노드 outputName 참조
  delivery?: "newExecution" | "sendToSession";
  onError?: "continue" | "pause" | "fail";
  outputName?: string;
}
```

### 4.3 5가지 Resume 전략

| 시나리오 | 전략 | 이유 |
|---------|------|------|
| 단일 세션 계속 | native resume | CLI 네이티브 세션 이어가기 |
| 포크 (customId) | prompt-concat | 새 대화 시작 |
| 다중 병합 | hybrid | 주 세션은 native, 보조는 컨텍스트 주입 |
| 크로스 CLI | prompt-concat | 다른 CLI는 세션 공유 불가 |
| 최신 | native (isLatest) | 마지막 세션 이어가기 |

### 4.4 base64 stdin 파이핑

셸 이스케이핑 문제 회피:
```
node -e "process.stdout.write(Buffer.from('base64...','base64').toString())" | cli-tool
```

### 4.5 triflux 적용안: `.tfx-workflow.json`

```json
{
  "version": "1.0",
  "name": "auth-refactor",
  "nodes": [
    {
      "id": "analyze",
      "instruction": "기존 인증 코드 분석, 취약점 식별",
      "tool": "gemini",
      "mode": "analysis",
      "outputName": "analysis_result"
    },
    {
      "id": "implement",
      "instruction": "{{analysis_result}} 기반으로 인증 모듈 리팩터링",
      "tool": "codex",
      "mode": "write",
      "contextRefs": ["analysis_result"]
    }
  ],
  "edges": [
    { "source": "analyze", "target": "implement" }
  ]
}
```

---

## 5. myclaude — Go Backend 인터페이스 + 통합 JSON 파서

### 5.1 Backend 인터페이스 (4 메서드)

**위치**: `codeagent-wrapper/internal/backend/backend.go:6-12`

```go
type Backend interface {
    Name() string
    BuildArgs(cfg *config.Config, targetArg string) []string
    Command() string
    Env(baseURL, apiKey string) map[string]string
}
```

**레지스트리**: 플랫 맵 (`registry.go:8-13`)
```go
var registry = map[string]Backend{
    "codex":    CodexBackend{},
    "claude":   ClaudeBackend{},
    "gemini":   GeminiBackend{},
    "opencode": OpencodeBackend{},
}
```

### 5.2 통합 JSON 스트림 파서

단일 `ParseJSONStreamInternal` 함수가 4개 백엔드의 JSON 출력을 자동 감지:
- `ThreadID` 있음 → Codex
- `Subtype`/`Result` 있음 → Claude
- `SessionID` + `Role`/`Delta` → Gemini
- `OpencodeSessionID` + `Part` → OpenCode

### 5.3 DAG 병렬 실행 (Kahn 알고리즘)

- `TopologicalSort` → `[][]TaskSpec` (레이어별 독립 태스크)
- 세마포어 기반 워커 풀 (`CODEAGENT_MAX_PARALLEL_WORKERS`)
- 실패 즉시 중단: 이전 레이어 실패 → 의존 태스크 스킵

### 5.4 anti-recursion 패턴

`claude.go:89`: `--setting-sources ""` → 스폰된 Claude가 부모의 SKILL.md를 재로드하는 무한 재귀 방지

### 5.5 triflux 적용안

```typescript
// hub/team/backend.mjs
export interface Backend {
  name: string;
  command: string;
  buildArgs(config: TaskConfig): string[];
  env(): Record<string, string>;
}

const registry = new Map([
  ["codex", new CodexBackend()],
  ["gemini", new GeminiBackend()],
  ["claude", new ClaudeBackend()],
]);
```

---

## 6. claude_code_bridge (CCB) — 독립 메모리 + 터미널 추상화

### 6.1 에이전트별 독립 메모리

**구조**: `.ccb/<provider>-session` JSON 파일 (프로바이더당 1개)
- 파일 레벨: 프로바이더별 고유 파일명
- 프로젝트 레벨: `ccb_project_id` (작업 디렉토리 해시)
- 인스턴스 레벨: `codex:auth` → `.codex-auth-session`

### 6.2 컨텍스트 전송 파이프라인

**위치**: `lib/memory/transfer.py` (~600 LoC)

```
세션 JSONL 파싱 → 중복 제거 (해시 기반) → 토큰 예산 절단 → 포맷 변환 (md/plain/JSON) → CLI send 또는 파일 저장
```

자동 전송: `CCB_CTX_TRANSFER_ON_SESSION_SWITCH=true` 시 세션 전환 때 자동 발동 (데몬 스레드, 락 기반 중복 방지)

### 6.3 TerminalBackend 추상화

```python
class TerminalBackend(ABC):
    def send_text(pane_id, text): ...
    def is_alive(pane_id): bool
    def kill_pane(pane_id): ...
    def activate(pane_id): ...
    def create_pane(direction, percent): pane_id
```

- `TmuxBackend`: `tmux` CLI, `%12` 형식 pane ID, `pipe-pane` 로깅
- `WeztermBackend`: `wezterm cli`, 정수 pane ID, CWD 기반 프로젝트 매칭

### 6.4 통합 TCP 데몬 (`askd`)

단일 프로세스, 다중 프로바이더:
- `ThreadingTCPServer` (토큰 인증, 유휴 타임아웃, PID 하트비트)
- `PerSessionWorkerPool` → 세션키당 1 워커 스레드 (큐 기반 직렬화)
- 8개 프로바이더 어댑터: Claude, Codex, Gemini, OpenCode, Droid, Copilot, CodeBuddy, Qwen

---

## 7. CLIProxyAPI — HTTP API 게이트웨이 + 포맷 변환

### 7.1 핵심 발견: CLI 스폰이 아닌 HTTP-to-HTTP 프록시

"CLIProxyAPI"의 의미: "CLI **도구를 위한** Proxy API" (CLI가 연결할 수 있는 API 엔드포인트 제공)

### 7.2 NxN 포맷 변환 레지스트리

```go
Registry map[Format]map[Format]RequestTransform
// 10개 포맷: openai, claude, gemini, gemini-cli, codex, antigravity, kimi, iflow, qwen, openai-compat
// TranslateRequest(from, to, model, rawJSON, stream)
// TranslateStream(from, to, model, ...) — SSE 라인별
// TranslateNonStream(from, to, model, ...) — 전체 응답
```

### 7.3 2-Level 라운드 로빈

```
Pick(provider, model):
  1. getAvailableAuths() — Disabled/Unavailable/Cooldown 필터
  2. priority 그룹 → 최고 우선순위만
  3. stable sort by Auth.ID
  4. cursor-based round-robin (key = provider:model)
  5. Gemini: 가상 부모 그룹 → 그룹 간 RR → 그룹 내 RR
  6. cursor map 4096 키 제한 + 전체 퇴거
```

**쿨다운**: 모델별 `ModelState.Unavailable` + `NextRetryAfter`, 전부 쿨다운 시 `Retry-After` 헤더 반환

### 7.4 triflux 적용안

hub/server.mjs에 `/v1/chat/completions` 라우트 추가:
1. model 이름 → hub 에이전트 토픽 매핑
2. 스트리밍: SSE 응답 → 에이전트 dispatch → 청크 포워딩
3. hub의 기존 에이전트 라우팅 재사용 (round-robin 추가)
4. 포맷 변환: OpenAI ↔ Claude만 (단일 쌍, ~200 LoC)

---

## 8. 통합 체리피킹 로드맵

### Phase 1: v7.3 (즉시 적용, 2주)

| 기술 | 출처 | 파일 | 예상 코드량 |
|------|------|------|-----------|
| Backend 인터페이스 | myclaude | hub/team/backend.mjs | ~200 LoC |
| 합의 품질 게이트 | claude-octopus | hub/quality-gate.mjs | ~300 LoC |
| base64 stdin 파이핑 | CCW | headless.mjs 수정 | ~50 LoC |
| anti-recursion | myclaude | headless.mjs 수정 | ~10 LoC |

### Phase 2: v7.5 (단기, 1개월)

| 기술 | 출처 | 파일 | 예상 코드량 |
|------|------|------|-----------|
| Q-Learning 동적 라우팅 | ruflo | hub/routing/q-learning.mjs | ~600 LoC |
| 복잡도 스코어링 | ruflo | hub/routing/complexity.mjs | ~200 LoC |
| SQLite 메일 버스 | overstory | hub/mail/store.mjs + client.mjs | ~400 LoC |

### Phase 3: v8.0 (중기, 2개월)

| 기술 | 출처 | 파일 | 예상 코드량 |
|------|------|------|-----------|
| 4-tier 충돌 해결 | overstory | hub/merge/resolver.mjs | ~700 LoC |
| 컨텍스트 전송 파이프라인 | CCB | hub/memory/transfer.mjs | ~600 LoC |
| JSON 선언적 워크플로우 | CCW | hub/workflow/executor.mjs | ~500 LoC |
| OpenAI 호환 API | CLIProxyAPI | hub/api/openai-compat.mjs | ~400 LoC |

### Phase 4: v9.0 (장기)

| 기술 | 출처 | 비고 |
|------|------|------|
| MoE 라우터 | ruflo | ONNX 임베딩 의존성 → Phase 3 Q-Learning 안정화 후 |
| 11 런타임 플러그인 | overstory | AgentRuntime 인터페이스 → 3개 런타임부터 시작 |
| NxN 포맷 변환 | CLIProxyAPI | 프로바이더 5+ 시 필요 |

---

## 9. 주의사항

### 9.1 검증된 주장 vs 미검증 주장

| 프로젝트 | 주장 | 검증 결과 |
|---------|------|----------|
| ruflo | SWE-bench 84.8% | **미검증** — 하네스 부재 |
| ruflo | "신경망 아키텍처" | **과장** — Q-Learning은 테이블 기반, MoE만 2층 퍼셉트론 |
| ruflo | 스웜 합의 | **스텁** — `Math.random() > 0.5` |
| claude-octopus | 75% 합의 게이트 | **검증됨** — quality.sh에 완전 구현 |
| overstory | ~1-5ms/query | **합리적** — SQLite WAL + 준비된 문장 |
| CCB | WYSIWYG | **부분 검증** — tmux는 pipe-pane, WezTerm은 get-text (실시간 스트림 아님) |

### 9.2 라이선스 주의

| 프로젝트 | 라이선스 | 체리피킹 시 주의 |
|---------|---------|----------------|
| claude-octopus | MIT | 자유 사용 가능 |
| ruflo | MIT | 자유 사용 가능 |
| overstory | MIT | 자유 사용 가능 |
| Claude-Code-Workflow | 미확인 | README 확인 필요 |
| myclaude | AGPL-3.0 | **주의**: 코드 직접 복사 시 AGPL 전파 가능. 알고리즘 재구현 권장 |
| CCB | MIT | 자유 사용 가능 |
| CLIProxyAPI | MIT | 자유 사용 가능 |

---

## 10. 출처 (코드 레퍼런스)

### claude-octopus
- `scripts/lib/quality.sh:62-89` — 품질 게이트 분기
- `scripts/lib/quality.sh:189-194` — 단계별 임계값
- `scripts/lib/dispatch.sh:16-115` — 프로바이더 dispatch
- `scripts/provider-router.sh:17-230` — 서킷 브레이커
- `agents/config.yaml` — 32 페르소나 정의

### ruflo
- `v3/@claude-flow/cli/src/ruvector/q-learning-router.ts` — Q-Learning (~600 LoC)
- `v3/@claude-flow/cli/src/ruvector/moe-router.ts` — MoE (~500 LoC)
- `v3/@claude-flow/cli/src/ruvector/model-router.ts` — 복잡도 스코어링
- `v3/@claude-flow/cli/src/memory/sona-optimizer.ts:276-316` — 4층 캐스케이드

### overstory
- `src/mail/store.ts:46-59` — 메일 버스 스키마
- `src/mail/client.ts:156-160` — 파괴적 커서
- `src/merge/resolver.ts:1-11` — 4-tier 전략
- `src/merge/resolver.ts:193-204` — hasContentfulCanonical
- `src/runtimes/types.ts:148-256` — AgentRuntime 인터페이스

### Claude-Code-Workflow
- `ccw/src/core/routes/orchestrator-routes.ts:57-161` — Flow/Node 타입
- `ccw/src/tools/resume-strategy.ts:50-110` — 5가지 resume 전략
- `ccw/src/tools/cli-prompt-builder.ts` — PromptConcatenator

### myclaude
- `codeagent-wrapper/internal/backend/backend.go:6-12` — Backend 인터페이스
- `codeagent-wrapper/internal/parser/parser.go:49-285` — 통합 JSON 파서
- `codeagent-wrapper/internal/executor/executor.go:466-633` — DAG 병렬 실행
- `codeagent-wrapper/internal/backend/claude.go:89` — anti-recursion

### CCB
- `lib/memory/transfer.py:23-548` — 컨텍스트 전송 파이프라인
- `lib/terminal.py:333-344` — TerminalBackend 추상화
- `lib/terminal.py:835-1327` — WezTerm 통합
- `lib/askd/daemon.py:99-256` — TCP 데몬

### CLIProxyAPI
- `internal/api/server.go:319-347` — 라우트 등록
- `sdk/cliproxy/auth/selector.go:255-313` — 2-level 라운드 로빈
- `sdk/translator/registry.go:49-66` — NxN 포맷 변환
- `internal/runtime/executor/claude_executor.go:93-260` — HTTP 프록시 실행

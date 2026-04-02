# Handoff Schema Design — Worker → Lead 결과 전달 프로토콜

## 목적

Worker(Codex/Gemini)가 작업 완료 후 Lead(Opus)에게 전달하는 **최소 요약 포맷**.
Lead 토큰 소모를 6-7x 줄이면서도, Lead가 올바른 의사결정을 할 수 있게 한다.
동시에 **TUI 대시보드의 데이터 소스**로도 사용된다.

## Opus vs Codex (GPT 5.4) 평가 비교

| 차원 | Opus | Codex (GPT 5.4) |
|------|------|-----------------|
| **포맷** | 평문 고정 스키마 | YAML 구조 (버전 필드 포함) |
| **토큰 목표** | 80-120 토큰 | 140-170 토큰, hard cap 180 |
| **요약 생성** | 워커가 직접 (`--- SUMMARY ---`) | 하이브리드 (워커 + 후처리 정규화) |
| **핵심 필드** | STATUS, TASK, FILES_CHANGED, VERDICT, CONFIDENCE, DETAIL | kind, status, lead_action, confidence, key_points, risk, artifacts |
| **고유 필드** | — | `lead_action` (accept/needs_read/retry/reassign/fallback) |
| **고유 필드** | — | `risk` (low/med/high) |
| **고유 인사이트** | FILES_CHANGED가 비교 불가 필수 (워커 간 충돌 감지) | MUST가 180 넘기면 줄이지 말고 lead_action=needs_read로 유도 |
| **실패 처리** | RETRYABLE 필드 추가 | stage(어디서 실패), retryable, partial 산출물 여부 |

### 합의점 (둘 다 동의)

1. **풀 출력은 파일에만** — Lead에게는 메타데이터만
2. **FILES_CHANGED/delta 필수** — 워커 간 충돌 감지, 의존 순서 결정
3. **CONFIDENCE/confidence 필수** — Lead의 "파일 읽기 여부" 판단 신호
4. **결론/판정 1문장 필수** — Lead가 즉시 의사결정
5. **실패 시 재시도 가능 여부 필수**

### 차이점에서 배울 것

- Codex의 `lead_action` 필드가 우수: Lead가 해야 할 다음 행동을 명시적으로 지시
- Codex의 하이브리드 생성(워커+후처리)이 안전: 포맷 흔들림 방지
- Opus의 80-120 토큰 목표가 더 공격적이지만 실용적

## 최종 채택 스키마 (v1)

Opus의 간결함 + Codex의 `lead_action` + `risk` 결합:

```
--- HANDOFF ---
status: ok | partial | failed
lead_action: accept | needs_read | retry | reassign
task: <1-3단어 태스크 유형>
files_changed: <경로 목록 또는 none>
verdict: <결론 1문장>
confidence: high | medium | low
risk: low | med | high
detail: <resultFile 경로>
```

### 실패 시 추가 필드

```
error_stage: dispatch | execution | timeout
retryable: yes | no
partial_output: yes | no
```

### 토큰 예산

- 성공: 80-120 토큰
- 실패: 60-90 토큰
- Hard cap: 150 토큰
- 150 초과 시: 줄이지 말고 `lead_action: needs_read`

## 시나리오별 예시

### 코드 구현 (성공)
```
--- HANDOFF ---
status: ok
lead_action: accept
task: implement rate-limiter
files_changed: src/middleware/rateLimiter.mjs, tests/rateLimiter.test.mjs
verdict: Token bucket rate limiter with per-route config, 2 tests passing
confidence: high
risk: low
detail: /tmp/tfx-headless/session-worker-1.txt
```

### 코드 리뷰 (문제 발견)
```
--- HANDOFF ---
status: partial
lead_action: needs_read
task: review auth-module
files_changed: none
verdict: needs changes — 1 critical (SQL injection in login query), 2 minor
confidence: high
risk: high
detail: /tmp/tfx-headless/session-worker-2.txt
```

### 분석 (성공)
```
--- HANDOFF ---
status: ok
lead_action: accept
task: analyze memory leak
files_changed: none
verdict: Leak traced to unclosed WebSocket handlers in psmux reconnect, ~12MB/hr
confidence: medium
risk: med
detail: /tmp/tfx-headless/session-worker-3.txt
```

### 실패
```
--- HANDOFF ---
status: failed
lead_action: retry
task: implement oauth-flow
files_changed: none
verdict: dependency @openid/client missing, npm install failed
confidence: high
risk: low
error_stage: execution
retryable: yes
detail: /tmp/tfx-headless/session-worker-4.txt
```

## 요약 생성 전략

### 하이브리드 (채택)

1. **워커 CLI (Codex/Gemini)**: 프롬프트에 `--- HANDOFF ---` 블록 생성 지시 추가
   - 의미 요약: verdict, confidence, risk, lead_action
   - 워커가 가장 잘 아는 정보 (무엇을 했는가, 확신도)

2. **후처리기 (headless 엔진)**: 스키마 검증/정규화
   - 고정 필드: status (exit code 기반), files_changed (git diff), detail (파일 경로)
   - 토큰 cap 적용: 150 초과 시 truncate + lead_action=needs_read
   - 워커가 HANDOFF 블록을 안 생성한 경우 → fallback (exit code + 파일 경로만)

## TUI 대시보드 연동

handoff 스키마의 필드가 **그대로 대시보드 렌더링 데이터**:

```
┌─ triflux dashboard ──────────────────────────────┐
│                                                   │
│  ⚪ codex (architect)  ✓ 32s  confidence: high    │
│     files: src/auth.mjs, tests/auth.test.mjs      │  ← files_changed
│     "Token bucket rate limiter 구현 완료"           │  ← verdict
│     risk: low | action: accept                    │  ← risk, lead_action
│                                                   │
│  🔵 gemini (writer)    ⏳ 45s  running...          │
│                                                   │
│  ⚪ codex (reviewer)   ✗ failed                   │
│     "dependency missing" | retryable              │  ← verdict, retryable
│     risk: low | action: retry                     │
│                                                   │
│  전체: 1✓ 1⏳ 1✗  |  경과: 47s                      │
└───────────────────────────────────────────────────┘
```

하나의 스키마가 **세 가지 목적**을 동시에 해결:
1. **Lead 토큰 절약** (1000 → 150 토큰/워커)
2. **TUI 대시보드 데이터 소스**
3. **핸드오프 아티팩트 표준화** (pipeline phase 간 전달)

## 구현 우선순위

| # | 작업 | 규모 |
|---|------|------|
| 1 | headless 엔진에서 HANDOFF 파싱 + Lead stdout 축소 | ✅ 완료 (v6.0.22) |
| 2 | 워커 프롬프트에 `--- HANDOFF ---` 생성 지시 추가 | M |
| 3 | 후처리기: 스키마 검증 + fallback | M |
| 4 | TUI 대시보드 (미래) | L |

## 관련 문서

- `docs/insights/native-agent-teams-research.md` — Native Teams SendMessage 패턴
- `docs/insights/wt-visualization-research.md` — WT 시각화 연구 결과
- `docs/GAP-ANALYSIS-2026-03-26.md` — 경쟁 프로젝트 Gap 분석
- `hub/team/headless.mjs` — headless 엔진
- `hub/team/cli/commands/start/start-headless.mjs` — 결과 출력 포맷

## 미래: WT 탭 내 Split-Pane 트릭

triflux 전용 탭을 같은 WT 창에 생성하고, 워커 뷰어를 그 안에서 split:

```
wt -w 0 ft -t <triflux탭> ; sp -H --profile triflux -- viewer ; ft -t <원래탭>
```

WT가 `;` 체이닝을 내부 처리하므로 거의 순간적. 스플릿은 포커스된 탭에서만 발생.

**전제조건**: 탭 인덱스 관리 (생성 시 저장 → 사용 시 읽기)
**구현 시점**: TUI 대시보드와 함께 (v7.1+)

```
WT 창:
  Tab 0: Claude Code     ← 사용자 작업 (포커스 유지)
  Tab 1: triflux viewer  ← 워커 split-pane 여기서만
    ├─ Pane 0: codex (architect) 출력
    ├─ Pane 1: gemini (writer) 출력
    └─ Pane 2: codex (reviewer) 출력
```

*Created: 2026-03-26*
*Contributors: Opus 4.6 (스키마 설계) + Codex GPT 5.4 (시나리오별 평가)*

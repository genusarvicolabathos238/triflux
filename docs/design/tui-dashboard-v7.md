# TUI Dashboard 설계 문서 — v7.1 (리서치 + 아키텍처)

## 1. 리서치 결과

### 1.1 경쟁사 TUI 벤치마크

| 프로젝트 | 스택 | TUI 특징 | 장점 | 단점 |
|---------|------|---------|------|------|
| **Ralph TUI** | Bun/TypeScript | 태스크별 진행 상태, pause/resume/kill | 실시간 이벤트, 에이전트 루프 시각화 | Bun 전용, tmux 의존 |
| **NTM** | Node.js + tmux | named pane, broadcast, conflict tracking | Claude/Codex/Gemini 동시 지원, TUI palette | tmux 필수 (Windows 미지원) |
| **IttyBitty** | Python | agent list + session + log 3-panel | 직관적 레이아웃 | Python 전용 |
| **OpenSwarm** | Node.js | Rich TUI + Web Dashboard (port 3847) | 듀얼 UI (터미널+웹) | 무거운 의존성 |
| **ORCH** | Rust | 실시간 이벤트 스트리밍, 토큰 카운트 | 네이티브 성능, 파일 수정 추적 | Rust 전용 |

### 1.2 Node.js TUI 프레임워크 비교

| 프레임워크 | 번들 | 의존성 | ESM | Windows | 마지막 업데이트 | 적합도 |
|-----------|------|--------|-----|---------|---------------|--------|
| **blessed** | 270KB | 0 | ✗ | 부분 | 2018 (사실상 중단) | ✗ |
| **neo-blessed** | 280KB | 0 | ✗ | 부분 | 2023 | △ |
| **@unblessed/core** | ~200KB | 소수 | ✓ | 미확인 | 2025+ | △ |
| **ink** (React) | ~150KB | react,yoga | ✓ | ✓ | 활발 | ○ |
| **terminal-kit** | ~400KB | 다수 | ✗ | 부분 | 2024 | △ |
| **ANSI 직접** | 0 | 0 | ✓ | ✓ | — | **◎** |

### 1.3 권장: Zero-Dependency ANSI Direct

**이유**:
1. triflux는 이미 ANSI 색상 코드를 광범위하게 사용 (headless.mjs, shared.mjs)
2. 외부 프레임워크 추가 = 설치 시간 + 번들 비대 + Windows 호환 리스크
3. 대시보드가 보여줄 데이터는 단순 (워커 N개의 status/verdict/confidence)
4. blessed 계열은 모두 유지보수 중단 또는 불안정
5. ink는 React 의존성이 과도 (CLI 오케스트레이터에 React는 과잉)

**핵심 ANSI 기법**:
- `\x1b[?1049h` / `\x1b[?1049l` — 대체 화면 버퍼 (진입/퇴장)
- `\x1b[H` — 커서 홈
- `\x1b[2J` — 화면 전체 클리어
- `\x1b[{row};{col}H` — 커서 절대 위치
- `\x1b[K` — 줄 끝까지 클리어
- `\x1b[?25l` / `\x1b[?25h` — 커서 숨기기/보이기

### 1.4 WT Split-Pane 제어 (v1.22+)

**확인된 기능**:
```bash
# 복합 레이아웃 한 줄 명령 (WT 1.22+)
wt -p "PowerShell" ; sp -V -p "Command Prompt" ; nt -p "Ubuntu" ; sp -H

# 포커스 탭 전환
wt -w 0 ft -t 0        # 첫 번째 탭으로 포커스

# pane 간 포커스 이동
wt -w 0 mf left         # 왼쪽 pane으로 포커스
```

**한계**:
- `nt` (new-tab)에 `--size` 미지원 (v6.1.2에서 수정)
- 포커스 탈취는 OS 레벨 제한 (완전 회피 불가)
- 탭 인덱스는 생성 순서 기반 (동적 조회 API 없음)

**triflux 전략**: 전용 탭에 split-pane 뷰어를 배치하되, 포커스는 원래 탭에 유지.

## 2. 아키텍처 설계

### 2.1 데이터 흐름

```
headless.mjs
  │ runHeadless() → 결과 수집
  │ processHandoff() → handoff 객체 생성
  ▼
hub/team/dashboard.mjs (신규)
  │ createDashboard(opts) → handle
  │ handle.update(workerStates) → ANSI 렌더
  │ handle.close() → 대체 화면 복원
  ▼
stdout (ANSI 대체 화면)
  │
  ├─ [모드 A] 인라인: 현재 터미널에 직접 렌더 (Claude Code stdout)
  └─ [모드 B] WT탭: triflux 전용 탭에서 렌더 (포커스 비탈취)
```

### 2.2 렌더링 레이아웃

```
┌─ triflux dashboard ──────────────────────────────────┐
│ ▲ triflux v7.1.0 │ 워커: 3/3 │ 경과: 47s │ ⏳ exec  │  ← 헤더
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚪ codex (architect)  ✓ 32s  confidence: high       │  ← 워커 카드
│     verdict: Token bucket rate limiter 구현 완료       │
│     files: src/auth.mjs, tests/auth.test.mjs          │
│     risk: low │ action: accept                        │
│                                                       │
│  🔵 gemini (writer)    ⏳ 45s  running...              │
│     (진행 중)                                          │
│                                                       │
│  ⚪ codex (reviewer)   ✗ failed                       │
│     verdict: dependency missing                        │
│     risk: low │ action: retry │ retryable: yes        │
│                                                       │
├──────────────────────────────────────────────────────┤
│ 파이프라인: plan→prd→confidence→exec→[deslop]→verify  │  ← 파이프라인 상태
│ 전체: 1✓ 1⏳ 1✗ │ 예상 토큰 절감: ~2,550              │  ← 푸터
└──────────────────────────────────────────────────────┘
```

### 2.3 모듈 구조

```
hub/team/dashboard.mjs (신규)
  ├─ createDashboard(opts) → DashboardHandle
  ├─ renderHeader(state) → string
  ├─ renderWorkerCard(worker) → string
  ├─ renderPipelineBar(phase) → string
  ├─ renderFooter(summary) → string
  └─ ansi.mjs (내부)
       ├─ altScreen(enter: boolean)
       ├─ moveTo(row, col)
       ├─ clearLine()
       ├─ color(text, ansiCode)
       └─ box(lines, width)
```

### 2.4 DashboardHandle API

```javascript
const dash = createDashboard({
  mode: 'inline' | 'wt-tab',    // 렌더링 모드
  refreshMs: 1000,               // 갱신 주기
  stream: process.stdout,        // 출력 스트림
});

// 워커 상태 업데이트 (handoff 객체 기반)
dash.updateWorker(paneName, {
  cli: 'codex',
  role: 'architect',
  status: 'running' | 'completed' | 'failed',
  elapsed: 32,
  handoff: { status, lead_action, confidence, risk, verdict, files_changed },
});

// 파이프라인 상태 업데이트
dash.updatePipeline({ phase: 'exec', fix_attempt: 0 });

// 강제 렌더
dash.render();

// 정리 (대체 화면 퇴장)
dash.close();
```

### 2.5 headless.mjs 통합 지점

```javascript
// runHeadlessInteractive()의 onProgress 콜백에서 대시보드 업데이트
onProgress: (event) => {
  if (event.type === 'session_created') dash = createDashboard({ mode: 'inline' });
  if (event.type === 'dispatched') dash.updateWorker(event.paneName, { status: 'running', cli: event.cli });
  if (event.type === 'progress') dash.updateWorker(event.paneName, { snapshot: event.snapshot });
  if (event.type === 'completed') {
    // handoff 결과 반영
    const result = results.find(r => r.paneName === event.paneName);
    if (result?.handoff) dash.updateWorker(event.paneName, { ...result, status: 'completed' });
  }
}
```

### 2.6 WT 전용 탭 모드 (모드 B)

```javascript
// autoAttachTerminal 대체: 뷰어 스크립트 대신 대시보드 프로세스 실행
wt.exe -w 0 nt --profile triflux --title "triflux dashboard"
  -- node hub/team/dashboard-viewer.mjs --session {sessionName}

// dashboard-viewer.mjs:
// 1. 대체 화면 진입
// 2. .tfx/state/ 또는 named pipe에서 워커 상태 폴링
// 3. 1초 간격 렌더
// 4. 세션 종료 시 자동 퇴장
```

## 3. 구현 계획

### Phase 1: 코어 렌더러 (S)
- `hub/team/dashboard.mjs` — ANSI 렌더링 엔진
- `hub/team/ansi.mjs` — ANSI escape 유틸리티
- 인라인 모드만 (WT 탭 모드 없이)
- 테스트 10개+

### Phase 2: headless 통합 (M)
- `runHeadlessInteractive` onProgress → 대시보드 연동
- handoff 결과 → 워커 카드 자동 업데이트
- pipeline 상태 → 파이프라인 바 연동
- `--dashboard` 플래그 추가

### Phase 3: WT 전용 탭 (M)
- `dashboard-viewer.mjs` — 독립 프로세스 뷰어
- autoAttachTerminal → 대시보드 뷰어로 전환
- 세션 종료 시 자동 탭 닫기
- `ft -t` 기반 원래 탭 복귀

### Phase 4: 고급 기능 (L)
- 토큰 절감 실시간 표시 (benchmarkStart/End 연동)
- 워커 간 충돌 감지 표시 (files_changed 교차)
- 히스토리 뷰 (완료된 워커 접기/펼치기)
- 키보드 입력: q=종료, r=새로고침, 방향키=워커 선택

## 4. 수락 기준 (PRD)

1. 워커 N개의 상태를 실시간 ANSI 대시보드로 표시
2. handoff 스키마 필드(status, verdict, confidence, risk, lead_action)를 렌더링
3. 파이프라인 현재 단계를 시각화
4. 외부 의존성 0 (Node.js 내장 모듈만)
5. Windows Terminal + psmux 환경에서 정상 동작
6. 대시보드 진입/퇴장 시 터미널 상태 완전 복원
7. 1초 이내 갱신 주기
8. 테스트 10개+ 통과

## 5. 관련 문서

- `docs/design/handoff-schema-v7.md` — handoff 데이터 소스
- `docs/insights/wt-visualization-research.md` — WT 제어 한계
- `hub/team/headless.mjs` — 통합 대상
- `hub/pipeline/index.mjs` — 파이프라인 상태 소스

## 6. 리서치 출처

- [blessed (GitHub)](https://github.com/chjj/blessed)
- [blessed vs ink (npm-compare)](https://npm-compare.com/blessed,ink)
- [@unblessed/core (npm)](https://www.npmjs.com/package/@unblessed/core)
- [Ralph TUI](https://ralph-tui.com/)
- [NTM Multi-Agent Tmux](https://vibecoding.app/blog/ntm-review)
- [IttyBitty Agent Orchestrator](https://adamwulf.me/2026/01/itty-bitty-ai-agent-orchestrator/)
- [tmuxcc TUI Dashboard](https://github.com/nyanko3141592/tmuxcc)
- [WT CLI Arguments (Microsoft)](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments)
- [WT Panes (Microsoft)](https://learn.microsoft.com/en-us/windows/terminal/panes)
- [WT split-pane focus issues (#6586)](https://github.com/microsoft/terminal/issues/6586)
- [ansi-escapes (npm)](https://www.npmjs.com/package/ansi-escapes)

*Created: 2026-03-26*
*Research: WebSearch + Brave Search + 기존 WT 연구*

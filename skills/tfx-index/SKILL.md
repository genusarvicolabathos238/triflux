---
name: tfx-index
description: 프로젝트 인덱싱으로 94% 토큰 절감. 58K→3K 토큰으로 전체 코드베이스 맵 생성. SuperClaude index-repo 오마주.
triggers:
  - 인덱싱
  - 프로젝트 인덱스
  - 인덱스
  - tfx-index
argument-hint: "[--update] [경로]"
---

# tfx-index — Project Indexing (94% Token Reduction)

> SuperClaude index-repo 오마주. 1회 2K 토큰으로 인덱스 생성, 이후 세션마다 55K 토큰 절감.

## 원리

매 세션마다 프로젝트 구조를 파악하려면 수십 개 파일을 읽어야 한다 (~58K tokens).
인덱스를 한 번 생성하면 3K 토큰짜리 PROJECT_INDEX.md만 읽으면 된다.

**ROI**: 1회 투자 2K → 세션당 55K 절감 → 10세션이면 550K 절감

## 워크플로우

### Step 0: 인덱싱 모드 선택

인자 없이 호출되거나 모드가 불명확한 경우, AskUserQuestion으로 모드를 선택받는다:

```
AskUserQuestion:
  "인덱싱 모드를 선택하세요:"
  1. 전체 인덱스 생성 (처음 또는 재생성)
  2. 증분 업데이트 (변경분만)
  3. 특정 디렉토리만
```

- 1번 선택 → Step 1부터 전체 실행
- 2번 선택 → `--update` 모드로 전환 (기존 인덱스 필요, 없으면 1번으로 fallback)
- 3번 선택 → 추가 AskUserQuestion으로 대상 디렉토리 경로 입력받음

`--update` 플래그나 경로 인자가 이미 제공된 경우 이 단계를 건너뛴다.

### Step 1: 파일 트리 스캔

```
병렬 Glob으로 전체 파일 트리 수집:
  - **/*.{ts,js,mjs,tsx,jsx,py,go,rs,java} (소스)
  - **/*.{md,json,yaml,toml} (설정/문서)
  - **/package.json, **/tsconfig.json (프로젝트 메타)

제외:
  - node_modules/, .git/, dist/, build/, coverage/
  - *.lock, *.log, *.map
```

### Step 2: 메타데이터 추출 (병렬)

각 소스 파일에서 핵심 메타데이터만 추출 (전체 읽기 금지):

```
파일당 추출 항목:
  - exports (함수, 클래스, 상수 이름)
  - imports (의존성)
  - 파일 크기 (라인 수)
  - 주요 패턴 (테스트? 설정? 컴포넌트? 유틸?)

추출 방법:
  - Grep으로 export/import 문 추출 (파일당 ~20줄만)
  - 전체 파일을 읽지 않음 → 토큰 절약
```

### Step 3: 인덱스 생성

```markdown
# PROJECT_INDEX.md
Generated: {date} | Files: {count} | Lines: {total_lines}

## Architecture
{1-2줄 아키텍처 요약}

## Directory Map
```
src/
  ├─ hub/          # MCP 메시지 버스 (bridge, router, pipe)
  │   ├─ team/     # 멀티-CLI 팀 모드 (headless, psmux, native)
  │   └─ pipeline/ # 상태 관리 (state, transitions, gates)
  ├─ skills/       # 스킬 정의 (tfx-*, SKILL.md)
  └─ bin/          # CLI 진입점
```

## Key Files
| File | Lines | Exports | Role |
|------|-------|---------|------|
| hub/bridge.mjs | 850 | BridgeServer, createBridge | MCP 프로토콜 브릿지 |
| hub/router.mjs | 720 | Router, routeRequest | 요청/응답 라우팅 |
| ... | ... | ... | ... |

## Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.x | HTTP 서버 |
| ... | ... | ... |

## Entry Points
- `bin/tfx` → CLI 메인
- `hub/bridge.mjs` → MCP 서버
- `skills/*/SKILL.md` → 스킬 정의
```

### Step 4: JSON 인덱스 (기계용)

```json
// PROJECT_INDEX.json (~10KB)
{
  "generated": "2026-03-29",
  "stats": { "files": 45, "lines": 12500 },
  "files": {
    "hub/bridge.mjs": {
      "lines": 850,
      "exports": ["BridgeServer", "createBridge"],
      "imports": ["express", "./router"],
      "type": "server"
    }
  },
  "graph": {
    "hub/bridge.mjs": ["hub/router.mjs", "hub/pipe.mjs"],
    "hub/router.mjs": ["hub/intent.mjs"]
  }
}
```

### Step 5: 검증

```
생성된 인덱스 검증:
  - 파일 수 일치 확인
  - 주요 진입점 포함 확인
  - 인덱스 크기 < 5KB 확인
```

## --update 모드

기존 인덱스가 있으면 git diff 기반 증분 업데이트:

```
변경된 파일만 재스캔 → 인덱스 부분 갱신
신규 파일 추가, 삭제된 파일 제거
전체 재생성 대비 ~80% 시간 절감
```

## 출력 위치

```
{project_root}/
  PROJECT_INDEX.md    ← 사람용 (3KB)
  PROJECT_INDEX.json  ← 기계용 (10KB)
```

## 토큰 예산

| 작업 | 토큰 |
|------|------|
| 스캔+추출 | ~1.5K |
| 인덱스 생성 | ~0.5K |
| **총합** | **~2K** |
| **세션당 절감** | **~55K** |

## 사용 예

```
/tfx-index                    # 전체 인덱스 생성
/tfx-index --update           # 증분 업데이트
/tfx-index src/hub            # 특정 디렉토리만
```

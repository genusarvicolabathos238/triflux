---
name: remote-spawn
description: >
  원격/로컬 머신에 Claude 세션을 psmux 기반으로 spawn하고 관리합니다.
  자동 핸드오프, 추가 프롬프트 전송, 세션 재부착, 원격 환경 자동 감지를 지원합니다.
  이 스킬은 다음 상황에서 반드시 사용하세요:
  원격 실행, 세션 spawn, 다른 머신에서 작업, 원격 Claude, 세션 전달, 핸드오프 전달,
  원격 세션에 프롬프트 보내기, 세션 목록, 세션 재부착.
  로컬 호스트 별칭이 references/hosts.json에 등록되어 있으면 호스트명 언급만으로도 트리거됩니다.
triggers:
  - remote-spawn
argument-hint: "[--host <name>] [--send <session> <prompt>] [--list] [--attach] <prompt or natural language>"
---

# remote-spawn — 원격/로컬 Claude 세션 관리

> psmux 세션 기반으로 Claude를 원격/로컬에서 실행하고 관리합니다.
> 대화 컨텍스트를 자동으로 핸드오프하고, 자연어로 세션을 제어할 수 있습니다.

## 입력 해석

사용자 입력을 아래 순서로 매칭한다. 매칭되면 해당 동작 실행.

```
"ultra4에서 보안 리뷰 해"       → spawn(host=ultra4, prompt="보안 리뷰 해")
"세션 목록 보여줘"              → list
"ultra4 세션에 테스트도 해달라고 전달해" → send(session=auto-detect, prompt="테스트도 해달라고")
"아까 그 세션 다시 열어"         → attach(session=most-recent)
"로컬에서 리팩터링 이어서"       → spawn(local, prompt="리팩터링 이어서")
```

### 호스트 감지

1. `--host <name>` 명시 → 그대로 사용
2. `references/hosts.json` 에 등록된 별칭/키워드 매칭 → 호스트 자동 해석
3. "원격에서", "다른 머신에서" → hosts.json의 default 호스트 사용
4. 매칭 없음 + --local 없음 → 사용자에게 "어떤 호스트에서 실행할까요?" 질문

`references/hosts.json`이 없으면 --host를 명시적으로 요구한다.

### 동작 분류

| 패턴 | 동작 | 설명 |
|------|------|------|
| 호스트 + 프롬프트 | **spawn** | 원격 Claude 세션 생성 |
| --local / "로컬에서" | **spawn local** | 로컬 Claude 세션 생성 |
| "전달해", "보내줘", --send | **send** | 기존 세션에 프롬프트 전송 |
| "목록", "세션 리스트", --list | **list** | 활성 세션 목록 |
| "다시 열어", "재부착", --attach | **attach** | WT 탭에 세션 재부착 |
| "환경 확인", --probe | **probe** | 원격 환경 프로브 (강제 갱신) |

## 실행 워크플로우

### spawn — 세션 생성 (핵심)

spawn은 3단계로 동작한다:

**1단계: 핸드오프 생성 (자동)**

사용자가 프롬프트만 준 경우, 현재 대화 맥락에서 핸드오프를 자동 생성한다.
핸드오프는 원격 Claude가 작업을 이해하는 데 필요한 최소 컨텍스트다.

핸드오프 구조:
```
## 작업 컨텍스트
- 현재 프로젝트: {프로젝트 경로}
- 작업 중인 파일: {최근 수정 파일 목록}
- 진행 상황: {현재 대화에서 완료한 것}

## 태스크
{사용자 프롬프트 또는 추출된 작업 지시}

## 참고
- {관련 결정 사항이나 제약}
```

핸드오프 생성 후 임시 파일에 저장: `.omc/handoff-{uuid8}.md`

사용자가 명시적으로 `--handoff <file>` 을 준 경우, 자동 생성 대신 해당 파일 사용.
사용자가 `/mp`로 생성한 핸드오프가 있으면 그것을 우선 사용.

**2단계: 환경 확인**

원격 호스트의 프로브 결과를 확인한다. 캐시가 있으면 캐시 사용.

```bash
node scripts/remote-spawn.mjs --probe {host}
```

프로브 결과에 따른 분기:

| claudePath | 동작 |
|------------|------|
| 유효한 경로 | 정상 진행 |
| null | 설치 안내 출력 후 사용자 확인 대기 |

**claude 미설치 시 안내 메시지:**

```
{host}에 Claude Code가 설치되어 있지 않습니다.

설치 방법:
  macOS/Linux: npm install -g @anthropic-ai/claude-code
  Windows:     winget install Anthropic.ClaudeCode

설치 후 `--probe {host}` 로 환경을 갱신하세요.
또는 이 호스트에서 다른 CLI(codex, gemini)로 작업하시겠습니까?
```

**3단계: 세션 실행**

```bash
node scripts/remote-spawn.mjs --host {host} --dir {dir} --prompt {prompt} --handoff {handoff_file}
```

실행 후 세션 이름을 사용자에게 알려준다:
```
spawned: tfx-spawn-ultra4-a1b2c3d4
WT 탭에서 Claude@ultra4 세션이 열립니다.
추가 프롬프트: /remote-spawn --send tfx-spawn-ultra4-a1b2c3d4 "다음 작업"
```

### send — 프롬프트 전송

사용자가 세션 이름을 명시하지 않으면, 해당 호스트의 가장 최근 세션을 자동 감지한다.

```bash
# 세션 이름 명시
node scripts/remote-spawn.mjs --send tfx-spawn-ultra4-a1b2c3d4 --prompt "{prompt}"

# 호스트명으로 자동 감지
node scripts/remote-spawn.mjs --list  # tfx-spawn-ultra4-* 필터링
# → 가장 최근 세션에 전송
node scripts/remote-spawn.mjs --send {detected_session} --prompt "{prompt}"
```

### list — 세션 목록

```bash
node scripts/remote-spawn.mjs --list
```

결과를 표 형태로 정리해서 보여준다:
```
| 세션 | 호스트 | 상태 |
|------|--------|------|
| tfx-spawn-ultra4-a1b2c3d4 | ultra4 | active |
| tfx-spawn-m2-e5f6g7h8 | m2 | active |
```

### attach — 재부착

```bash
node scripts/remote-spawn.mjs --attach {session_name}
```

세션 이름 미지정 시 가장 최근 세션을 사용한다.

### probe — 환경 확인

```bash
node scripts/remote-spawn.mjs --probe {host}
```

결과를 사람이 읽기 좋게 정리:
```
ultra4 환경:
  OS: Windows (win32)
  Shell: pwsh
  Home: C:\Users\SSAFY
  Claude: C:\Users\SSAFY\.local\bin\claude.exe
```

## 전제 조건

- **psmux** 설치 (권장, 전체 기능). 미설치 시 기존 WT+SSH fallback.
- `remoteControlAtStartup: true` 설정 (`triflux setup` 자동)
- 원격 호스트: SSH config 등록 + Claude Code 설치
- 로컬: Windows Terminal

## 호스트 설정

`references/hosts.json`에 개인 호스트 별칭을 등록한다.
이 파일은 프로젝트에 커밋하지 않고 로컬에서만 관리한다 (.gitignore 추가).

```json
{
  "hosts": {
    "ultra4": {
      "description": "Windows 데스크탑",
      "aliases": ["울트라", "데스크탑"],
      "default_dir": "~/Desktop/Projects"
    },
    "m2": {
      "description": "MacBook Pro",
      "aliases": ["맥북", "맥"],
      "default_dir": "~/projects"
    }
  },
  "default_host": "ultra4",
  "triggers": ["원격에서", "다른 머신에서", "다른 컴퓨터에서"]
}
```

이 파일이 없으면 호스트 자동 감지가 비활성화되고, --host를 명시해야 한다.

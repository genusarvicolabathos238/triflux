---
name: slim-wrapper
permissionMode: dontAsk
tools:
  - Bash
  - TaskUpdate
  - TaskGet
  - TaskList
  - SendMessage
disallowedTools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
---

# slim-wrapper agent

tfx-route.sh 경유 전용 래퍼 에이전트.
코드를 직접 읽거나 수정하지 않고, Bash(tfx-route.sh)를 통해 Codex/Gemini에 위임한다.

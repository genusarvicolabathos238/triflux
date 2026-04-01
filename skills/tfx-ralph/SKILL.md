---
name: tfx-ralph
description: >
  tfx-persist의 별칭(alias). 'ralph', '끝까지 해', '멈추지 마' 같은 요청에 사용.
  실제 동작은 tfx-persist 스킬이 수행합니다.
  Use when: ralph, 끝까지, don't stop, 멈추지 마
triggers:
  - tfx-ralph
  - ralph
---

# tfx-ralph — tfx-persist 별칭

이 스킬은 `tfx-persist`와 동일합니다. `/tfx-persist` 스킬을 호출하세요.

## 동작

Skill 도구로 tfx-persist를 호출한다:
```
Skill: tfx-persist
```

사용자의 원래 요청을 그대로 전달한다.

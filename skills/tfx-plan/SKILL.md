---
name: tfx-plan
description: 경량 구현 계획. Claude Opus 단독으로 빠른 태스크 분해 + 실행 계획.
triggers:
  - plan
  - 계획
  - 플랜
  - 설계
argument-hint: "<구현할 기능 설명>"
---

# tfx-plan — Light Implementation Plan

> Claude Opus 단독 빠른 계획. 복잡한 합의 없이 즉시 태스크 분해.

## 워크플로우

### Step 1: 요구사항 파싱
사용자 입력 + 프로젝트 컨텍스트(PROJECT_INDEX.md 있으면 활용)에서 핵심 추출.

### Step 2: Claude Opus 계획 수립
```
"소프트웨어 아키텍트로서 다음 기능의 구현 계획을 수립하라:
 기능: {feature}
 프로젝트 컨텍스트: {context}

 출력 형식:
 1. 영향 범위 (수정할 파일 목록)
 2. 태스크 분해 (순서대로, 각 태스크에 검증 방법 포함)
 3. 리스크 및 의존성
 4. 예상 복잡도 (low/medium/high)"
```

### Step 3: 구조화된 계획 출력
```markdown
## 구현 계획: {feature}

### 영향 범위
- `src/auth/middleware.ts` — 신규 생성
- `src/routes/index.ts` — 수정 (라우트 추가)

### 태스크
1. [ ] {태스크1} → 검증: {확인 방법}
2. [ ] {태스크2} → 검증: {확인 방법}
3. [ ] {태스크3} → 검증: {확인 방법}

### 리스크
- {리스크1}: 완화 방안 — {방안}

### 복잡도: {level}
```

## 토큰: ~8K

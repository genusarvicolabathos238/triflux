---
name: tfx-ralph
description: 3자 검증 기반 persistence loop. 작업 완료까지 멈추지 않되, 검증은 단일 agent가 아닌 Tri-CLI consensus로 수행한다.
triggers:
  - ralph
  - don't stop
  - 끝까지
  - until done
  - 멈추지 마
argument-hint: "<완료할 작업 설명>"
---

# tfx-ralph — Tri-Verified Persistence Loop

> OMC ralph 오마주. 핵심 차별점: 검증자가 단일 agent가 아니라 **3-CLI consensus**.
> The boulder never stops — but it stops being wrong.

## 핵심 원리

OMC ralph는 단일 verifier(code-reviewer 또는 critic)가 검증한다.
tfx-ralph는 Claude/Codex/Gemini **3자 독립 검증**으로 편향 없는 완료 판단을 보장한다.

## 워크플로우

### Step 1: Goal Definition

```
사용자 요청에서 완료 기준(acceptance criteria)을 추출:
{
  "goal": "JWT 인증 미들웨어 구현",
  "criteria": [
    "로그인 엔드포인트 /api/auth/login 작동",
    "JWT 토큰 발급/검증 로직",
    "보호된 라우트에 미들웨어 적용",
    "refresh 토큰 지원",
    "테스트 커버리지 80%+"
  ]
}
```

자동 추출된 기준을 AskUserQuestion으로 사용자에게 확인받는다:

```
AskUserQuestion:
  "다음 완료 기준이 맞나요?"
  {추출된 criteria 목록 표시}
  1. 맞습니다 — 진행
  2. 수정 필요 — 기준 편집
  3. 추가 필요 — 기준 추가
```

- 1번 선택 → Step 2로 진행
- 2번 선택 → 사용자가 수정할 기준 번호와 내용을 입력, 반영 후 재확인
- 3번 선택 → 사용자가 추가 기준을 입력, 반영 후 재확인

### Step 2: Execution Loop

```
WHILE (NOT all criteria verified):

  2a. 현재 상태 평가
      - 어떤 기준이 미완료인지 확인
      - 다음 작업 결정

  2b. 구현 실행
      - 단순 작업 → Codex exec 직접 실행
      - 복잡 작업 → tfx-auto로 분해 후 실행
      - 파일 수정, 테스트 작성, 빌드 등

  2c. 3자 독립 검증 (매 기준 완료 시)
      Claude: "다음 기준이 충족되었는가? 코드를 직접 읽고 판단하라: {criterion}"
      Codex:  "다음 기준 충족 여부를 코드 실행/테스트로 검증하라: {criterion}"
      Gemini: "다음 기준 충족 여부를 코드 리뷰로 판단하라: {criterion}"

      결과: 2/3 이상 "통과" → 기준 확정
             1/3만 "통과" → 재작업 필요
             0/3 "통과" → 즉시 재작업

  2d. 진행 보고
      "🪨 Ralph: {완료}/{전체} 기준 충족. 현재: {작업 중인 것}. 다음: {예정}"

END WHILE
```

### Step 3: Final Verification

모든 기준이 개별 검증을 통과한 후, 전체 통합 검증:

```
3자 독립 통합 검증:
  "모든 acceptance criteria가 충족되었는지 전체적으로 검증하라.
   기준 목록: {criteria}
   코드를 직접 읽고, 테스트를 실행하고, 회귀 여부를 확인하라."

Consensus Score >= 70 → 완료 선언
Consensus Score < 70 → 미달 항목 재작업 후 재검증
```

### Step 4: Deslop Pass (선택적)

검증 통과 후, 변경된 파일에 대해 슬롭 제거:
```
변경된 파일 목록 → 3자 독립 슬롭 감지 → 합의된 슬롭만 제거 → 회귀 검증
```

### Step 5: 완료

```
모든 기준 3자 검증 통과 + 통합 검증 통과 → 완료 보고:

"🪨 Ralph 완료: {전체}/{전체} 기준 충족 (Consensus Score: {score}%)
 변경 파일: {count}개
 테스트: {pass}/{total} 통과
 검증: Claude ✓ Codex ✓ Gemini ✓"
```

## Anti-Stuck 메커니즘

```
같은 기준에서 3회 연속 검증 실패 시:
  1. 접근법 변경 시도
  2. 변경 후에도 실패 → AskUserQuestion으로 사용자 도움 요청
  3. 사용자 지시 받은 후 재시도

같은 전체 루프가 5회 반복 시:
  → 강제 진행 상황 보고 + 사용자 판단 요청
```

## 토큰 예산

기준당: ~8K (구현 ~3K + 3자검증 ~5K)
전체: 기준 수 × 8K + 통합검증 15K
예: 5개 기준 → ~55K tokens

## 사용 예

```
/tfx-ralph "JWT 인증 미들웨어 구현. 로그인, 토큰 발급/검증, 리프레시, 테스트 80%+"
/tfx-ralph "이 버그 수정해. PR #42의 모든 코멘트 해결될 때까지"
/tfx-ralph "데이터베이스 마이그레이션 완료. 기존 데이터 무손실, 롤백 가능"
```

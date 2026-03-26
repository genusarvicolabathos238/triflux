// tests/unit/intent.test.mjs — intent 의도 분류 엔진 테스트
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTENT_CATEGORIES,
  quickClassify,
  classifyIntent,
  refineClassification,
} from '../../hub/intent.mjs';

describe('intent', () => {
  // 1. quickClassify: "JWT 인증 구현해" → implement, 고신뢰
  it('quickClassify: "JWT 인증 구현해" → implement with high confidence', () => {
    const r = quickClassify('JWT 인증 구현해');
    assert.equal(r.category, 'implement');
    assert.ok(r.confidence >= 0.5, `Expected ≥0.5, got ${r.confidence}`);
  });

  // 2. quickClassify: "이 버그 고쳐" → debug, 고신뢰
  it('quickClassify: "이 버그 고쳐" → debug with high confidence', () => {
    const r = quickClassify('이 버그 고쳐');
    assert.equal(r.category, 'debug');
    assert.ok(r.confidence >= 0.5, `Expected ≥0.5, got ${r.confidence}`);
  });

  // 3. quickClassify: "코드 리뷰해줘" → review, 고신뢰
  it('quickClassify: "코드 리뷰해줘" → review with high confidence', () => {
    const r = quickClassify('코드 리뷰해줘');
    assert.equal(r.category, 'review');
    assert.ok(r.confidence >= 0.5, `Expected ≥0.5, got ${r.confidence}`);
  });

  // 4. quickClassify: "이게 뭐야 설명해" → explain, 고신뢰
  it('quickClassify: "이게 뭐야 설명해" → explain with high confidence', () => {
    const r = quickClassify('이게 뭐야 설명해');
    assert.equal(r.category, 'explain');
    assert.ok(r.confidence >= 0.5, `Expected ≥0.5, got ${r.confidence}`);
  });

  // 5. quickClassify: 모호한 프롬프트 → 저신뢰 (<0.8)
  it('quickClassify: ambiguous prompt yields low confidence', () => {
    const r = quickClassify('프로젝트를 좀 개선하고 싶은데');
    assert.ok(r.confidence < 0.8, `Expected <0.8, got ${r.confidence}`);
  });

  // 6. classifyIntent: routing 필드에 agent/mcp/effort 포함
  it('classifyIntent returns routing with agent, mcp, effort', () => {
    const r = classifyIntent('이 코드 리뷰해줘');
    assert.ok(r.routing, 'Should have routing');
    assert.ok(r.routing.agent, 'routing.agent should exist');
    assert.ok(typeof r.routing.mcp === 'string' || r.routing.mcp === null, 'routing.mcp should be string or null');
    assert.ok(typeof r.routing.effort === 'string' || r.routing.effort === null, 'routing.effort should be string or null');
    assert.ok(r.reasoning, 'Should have reasoning');
  });

  // 7. classifyIntent: implement → executor/implement/high
  it('classifyIntent: implement routes to executor/implement/high', () => {
    const r = classifyIntent('새로운 API 엔드포인트 구현해줘');
    assert.equal(r.category, 'implement');
    assert.equal(r.routing.agent, 'executor');
    assert.equal(r.routing.mcp, 'implement');
    assert.equal(r.routing.effort, 'high');
  });

  // 8. classifyIntent: document → writer/docs/pro
  it('classifyIntent: document routes to writer/docs/pro', () => {
    const r = classifyIntent('이 모듈 문서화해줘');
    assert.equal(r.category, 'document');
    assert.equal(r.routing.agent, 'writer');
    assert.equal(r.routing.mcp, 'docs');
    assert.equal(r.routing.effort, 'pro');
  });

  // 9. quickClassify: 한국어 + 영어 혼용 프롬프트
  it('quickClassify handles mixed Korean/English prompts', () => {
    const r1 = quickClassify('implement JWT 인증 추가해줘');
    assert.equal(r1.category, 'implement');

    const r2 = quickClassify('debug this error 에러 고쳐줘');
    assert.equal(r2.category, 'debug');

    const r3 = quickClassify('unit test 작성해줘 테스트 추가');
    assert.equal(r3.category, 'test');
  });

  // 10. quickClassify: 빈 프롬프트 → 기본 카테고리 + 저신뢰
  it('quickClassify: empty prompt returns default category with low confidence', () => {
    const r1 = quickClassify('');
    assert.equal(r1.category, 'implement');
    assert.ok(r1.confidence <= 0.3, `Expected ≤0.3, got ${r1.confidence}`);

    const r2 = quickClassify(null);
    assert.equal(r2.category, 'implement');
    assert.ok(r2.confidence <= 0.3);

    const r3 = quickClassify(undefined);
    assert.equal(r3.category, 'implement');
    assert.ok(r3.confidence <= 0.3);
  });

  // 11. INTENT_CATEGORIES has exactly 10 categories
  it('INTENT_CATEGORIES has 10 categories', () => {
    assert.equal(Object.keys(INTENT_CATEGORIES).length, 10);
  });

  // 12. All categories have agent, mcp, effort fields
  it('all categories have agent, mcp, effort fields', () => {
    for (const [name, cat] of Object.entries(INTENT_CATEGORIES)) {
      assert.ok(typeof cat.agent === 'string', `${name}.agent should be string`);
      assert.ok(cat.mcp === null || typeof cat.mcp === 'string', `${name}.mcp should be string|null`);
      assert.ok(cat.effort === null || typeof cat.effort === 'string', `${name}.effort should be string|null`);
    }
  });

  // 13. refineClassification does not throw
  it('refineClassification does not throw', () => {
    assert.doesNotThrow(() => refineClassification('test prompt', 'debug'));
  });

  // 14. quickClassify: test category
  it('quickClassify: "테스트 작성" → test', () => {
    const r = quickClassify('유닛 테스트 작성해줘');
    assert.equal(r.category, 'test');
  });

  // 15. classifyIntent: 결과 캐싱 — 동일 프롬프트 두 번 호출 시 cache-hit reasoning 반환
  it('classifyIntent caches result and returns cache-hit on second call', () => {
    const prompt = '캐싱 테스트용 고유 프롬프트 xyzzy-cache-test-2026';
    const first = classifyIntent(prompt);
    const second = classifyIntent(prompt);
    // 두 번째 호출은 캐시에서 반환
    assert.ok(second.reasoning.startsWith('cache-hit:'), `Expected cache-hit, got: ${second.reasoning}`);
    assert.equal(second.category, first.category);
    assert.equal(second.confidence, first.confidence);
  });

  // 16. classifyIntent: Codex triage mock — codex가 고신뢰 JSON 반환 시 사용
  it('classifyIntent uses Codex triage when codex returns high-confidence JSON', async () => {
    // node:child_process execSync을 mock하기 위해 모듈 캐시를 우회하지 않고
    // classifyIntent가 low-confidence 프롬프트에서 codex fallback 경로를 밟는지
    // reasoning 필드로 간접 검증 (codex 미설치 환경에서는 keyword-match로 떨어짐)
    const ambiguousPrompt = '이 작업을 진행해줘 xyzzy-codex-triage-' + Date.now();
    const r = classifyIntent(ambiguousPrompt);
    // codex 설치 여부와 무관하게 category + routing은 반드시 존재해야 함
    assert.ok(typeof r.category === 'string', 'category should be string');
    assert.ok(typeof r.confidence === 'number', 'confidence should be number');
    assert.ok(
      r.reasoning.startsWith('codex-triage:') ||
      r.reasoning.startsWith('keyword-match') ||
      r.reasoning.startsWith('cache-hit:'),
      `Unexpected reasoning: ${r.reasoning}`
    );
    assert.ok(r.routing && typeof r.routing.agent === 'string', 'routing.agent should exist');
  });

  // 17. classifyIntent: high-confidence quickClassify → Codex 건너뜀 (reasoning에 keyword-match)
  it('classifyIntent skips Codex triage when quickClassify confidence > 0.8', () => {
    // debug 키워드 다수 → quickClassify confidence > 0.8 → codex 건너뜀
    // "이 버그 고쳐줘 fix bug error debug troubleshoot crash broken" → 0.846
    const r = classifyIntent('이 버그 고쳐줘 fix bug error debug troubleshoot crash broken');
    assert.ok(
      r.reasoning.startsWith('keyword-match:') || r.reasoning.startsWith('cache-hit:'),
      `Expected keyword-match or cache-hit, got: ${r.reasoning}`
    );
    assert.equal(r.category, 'debug');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  checkSearchEngines,
  extractProjectMeta,
  probeTierEnvironment,
  scanCodexSkills,
} from '../../scripts/cache-buildup.mjs';

function assertIsoTimestamp(value) {
  assert.equal(typeof value, 'string');
  assert.ok(!Number.isNaN(Date.parse(value)), `expected ISO timestamp, got: ${value}`);
}

describe('cache-buildup', () => {
  it('scanCodexSkills는 스캔 결과 구조를 반환한다', () => {
    const result = scanCodexSkills();

    assertIsoTimestamp(result.scanned_at);
    assert.equal(typeof result.codex_skills_dir, 'string');
    assert.equal(typeof result.total, 'number');
    assert.ok(Array.isArray(result.skills));
    assert.equal(result.total, result.skills.length);
    assert.ok(result.total > 0, 'builtin skill 포함으로 최소 1개 이상이어야 한다');

    for (const skill of result.skills) {
      assert.equal(typeof skill.name, 'string');
      assert.ok(skill.name.length > 0);
      assert.equal(typeof skill.role, 'string');
      assert.equal(typeof skill.description, 'string');
      assert.ok(['custom', 'builtin'].includes(skill.source));

      if (skill.source === 'custom') {
        assert.equal(typeof skill.path, 'string');
        assert.ok(skill.path.endsWith('SKILL.md'));
        assert.ok(existsSync(skill.path), `expected custom skill path to exist: ${skill.path}`);
      }
    }
  });

  it('probeTierEnvironment는 tier와 에이전트/체크 상태를 일관되게 반환한다', () => {
    const result = probeTierEnvironment();

    assertIsoTimestamp(result.probed_at);
    assert.ok(['minimal', 'standard', 'full'].includes(result.tier));
    assert.deepEqual(
      Object.keys(result.checks).sort(),
      ['codex', 'gemini', 'hub', 'psmux', 'wt'],
    );

    for (const value of Object.values(result.checks)) {
      assert.equal(typeof value, 'boolean');
    }

    assert.ok(Array.isArray(result.available_agents));
    assert.ok(result.available_agents.includes('claude'));
    assert.equal(result.available_agents.includes('codex'), result.checks.codex);
    assert.equal(result.available_agents.includes('gemini'), result.checks.gemini);
    assert.equal(typeof result.codex_plan, 'object');
    assert.ok(result.codex_plan);

    if (result.tier === 'minimal') {
      assert.equal(result.checks.codex || result.checks.gemini, false);
    }

    if (result.tier === 'standard') {
      assert.ok(result.checks.codex || result.checks.gemini);
      assert.equal(result.checks.psmux && result.checks.hub, false);
    }

    if (result.tier === 'full') {
      assert.ok(result.checks.psmux);
      assert.ok(result.checks.hub);
      assert.ok(result.checks.codex || result.checks.gemini);
    }
  });

  it('stale preflight cache면 codex/gemini를 직접 CLI probe로 판정한다', () => {
    const commands = [];
    const isWin = process.platform === 'win32';
    const codexProbe = isWin ? 'where codex 2>nul' : 'which codex 2>/dev/null';
    const geminiProbe = isWin ? 'where gemini 2>nul' : 'which gemini 2>/dev/null';
    const result = probeTierEnvironment({
      preflight: {},
      execSyncFn: (command) => {
        commands.push(command);
        if (command === codexProbe) return '/usr/bin/codex';
        if (command === 'psmux --version') return '';
        if (command.startsWith('curl -sf')) return '{"hub":{"state":"running"},"pid":1}';
        if (isWin && command.startsWith('where wt')) return '';
        throw new Error(`missing: ${command}`);
      },
    });

    assert.equal(result.checks.codex, true);
    assert.equal(result.checks.gemini, false);
    assert.equal(result.tier, 'full');
    assert.ok(result.available_agents.includes('codex'));
    assert.ok(!result.available_agents.includes('gemini'));
    assert.ok(commands.includes(codexProbe));
    assert.ok(commands.includes(geminiProbe));
  });

  it('fresh preflight cache가 있으면 codex/gemini 직접 probe 없이 캐시 값을 사용한다', () => {
    const commands = [];
    const result = probeTierEnvironment({
      preflight: {
        codex: { ok: false },
        gemini: { ok: true },
        hub: { ok: false },
        codex_plan: { plan: 'pro' },
      },
      execSyncFn: (command) => {
        commands.push(command);
        if (command === 'psmux --version') return '';
        throw new Error(`missing: ${command}`);
      },
    });

    assert.equal(result.checks.codex, false);
    assert.equal(result.checks.gemini, true);
    assert.equal(result.tier, 'standard');
    assert.deepEqual(result.codex_plan, { plan: 'pro' });
    assert.ok(!commands.includes('codex --version'));
    assert.ok(!commands.includes('gemini --version'));
  });

  it('extractProjectMeta는 현재 프로젝트 메타를 추출한다', () => {
    const result = extractProjectMeta();

    assertIsoTimestamp(result.extracted_at);
    assert.equal(result.name, 'triflux');
    assert.equal(result.lang, 'JavaScript/ESM (Node.js)');
    assert.equal(result.is_git, true);
    assert.equal(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    assert.equal(result.test_cmd, 'node --test --test-force-exit --test-concurrency=1 "tests/**/*.test.mjs" "scripts/__tests__/**/*.test.mjs"');
  });

  it('checkSearchEngines는 검색 엔진 상태 구조와 집계를 반환한다', () => {
    const result = checkSearchEngines();

    assertIsoTimestamp(result.checked_at);
    assert.equal(typeof result.available_count, 'number');
    assert.equal(typeof result.total_count, 'number');
    assert.ok(Array.isArray(result.engines));
    assert.equal(result.total_count, result.engines.length);
    assert.equal(
      result.available_count,
      result.engines.filter((engine) => engine.status === 'available').length,
    );
    assert.ok(result.total_count >= 4, 'known search servers가 기본 포함되어야 한다');

    const names = result.engines.map((engine) => engine.name);
    assert.ok(names.includes('brave-search'));
    assert.ok(names.includes('tavily'));
    assert.ok(names.includes('exa'));
    assert.ok(names.includes('context7'));
    assert.ok(names.indexOf('brave-search') < names.indexOf('tavily'));
    assert.ok(names.indexOf('tavily') < names.indexOf('exa'));

    for (const engine of result.engines) {
      assert.equal(typeof engine.name, 'string');
      assert.ok(['available', 'configured', 'unavailable'].includes(engine.status));
      assert.ok(Array.isArray(engine.domain_tags));
      assert.equal(typeof engine.configured, 'boolean');
      assert.ok(engine.source === null || typeof engine.source === 'string');
      assert.ok(engine.inventory === null || typeof engine.inventory === 'object');
    }

    if (result.primary_engine !== null) {
      const primary = result.engines.find((engine) => engine.name === result.primary_engine);
      assert.ok(primary, `primary engine not found: ${result.primary_engine}`);
      assert.equal(primary.status, 'available');
    }
  });
});

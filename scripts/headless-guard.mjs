#!/usr/bin/env node
/**
 * headless-guard.mjs — PreToolUse 훅 (auto-route 모드)
 *
 * Phase 3 headless 모드 활성 중 Lead가 Bash(tfx-route.sh)로 개별 호출하면
 * deny 대신 자동으로 headless 명령으로 변환한다.
 *
 * 동작:
 * - 마커 존재 + Bash(tfx-route.sh agent prompt mcp) → updatedInput: tfx multi --headless --assign
 * - 마커 존재 + Agent(codex/gemini CLI 워커) → deny (tool 타입 변환 불가, 안내 메시지)
 * - 마커 없음 → 전부 통과
 * - 마커 30분 초과 → 자동 만료 (stale 방지)
 *
 * Exit 0 + stdout JSON: auto-route (updatedInput)
 * Exit 2 + stderr: deny (Agent CLI 래핑만)
 * Exit 0 (no stdout): allow
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK_FILE = join(tmpdir(), "tfx-headless-guard.lock");
const MAX_AGE_MS = 30 * 60 * 1000; // 30분

function isLockActive() {
  if (!existsSync(LOCK_FILE)) return false;
  try {
    const ts = Number(readFileSync(LOCK_FILE, "utf8").trim());
    if (Date.now() - ts > MAX_AGE_MS) {
      unlinkSync(LOCK_FILE);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * tfx-route.sh 명령에서 agent, prompt를 파싱한다.
 * 형식: bash ~/.claude/scripts/tfx-route.sh {agent} '{prompt}' {mcp} [timeout] [context]
 */
function parseRouteCommand(cmd) {
  // MCP 프로필 목록 (tfx-route.sh의 마지막 위치 인자)
  const MCP_PROFILES = ["implement", "analyze", "review", "docs"];

  // 전략: agent명 추출 후, 나머지에서 MCP 프로필을 역방향으로 찾아 프롬프트 경계를 결정
  const agentMatch = cmd.match(/tfx-route\.sh\s+(\S+)\s+/);
  if (!agentMatch) return null;

  const agent = agentMatch[1];
  const afterAgent = cmd.slice(agentMatch.index + agentMatch[0].length);

  // MCP 프로필을 역방향으로 찾기
  let mcp = "";
  let promptRaw = afterAgent;
  for (const profile of MCP_PROFILES) {
    // 프롬프트 뒤에 오는 MCP 프로필 (공백 구분)
    const profileIdx = afterAgent.lastIndexOf(` ${profile}`);
    if (profileIdx >= 0) {
      mcp = profile;
      promptRaw = afterAgent.slice(0, profileIdx);
      break;
    }
  }

  // 프롬프트에서 바깥쪽 따옴표 제거
  const prompt = promptRaw
    .replace(/^['"]/, "")
    .replace(/['"]$/, "")
    .replace(/'\\''/g, "'")  // bash '\'' → '
    .replace(/'"'"'/g, "'")  // bash '"'"' → '
    .trim();

  return { agent, prompt, mcp };
}

function autoRoute(updatedCommand, reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { command: updatedCommand },
      additionalContext: reason,
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

function deny(reason) {
  process.stderr.write(reason);
  process.exit(2);
}

async function main() {
  if (!isLockActive()) process.exit(0);

  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = input.tool_name || "";
  const toolInput = input.tool_input || {};

  // ── Bash: tfx-route.sh → headless auto-route ──
  if (toolName === "Bash") {
    const cmd = toolInput.command || "";

    // 이미 headless 명령이면 통과
    if (cmd.includes("tfx multi") || cmd.includes("triflux.mjs multi")) {
      process.exit(0);
    }

    // 마커 조작 통과
    if (cmd.includes("tfx-headless-guard")) {
      process.exit(0);
    }

    // codex/gemini 직접 CLI 호출 감지 → deny (auto-route 불가: 원본 agent/role 정보 없음)
    if (/\bcodex\s+exec\b/.test(cmd) || /\bgemini\s+(-p|--prompt)\b/.test(cmd)) {
      deny(
        "[headless-guard] Phase 3 활성 중. codex/gemini를 직접 호출하지 마세요. " +
        'Bash("tfx multi --teammate-mode headless --assign \'codex:prompt:role\' ...") 로 headless 엔진에 위임하세요.',
      );
    }

    // tfx-route.sh 개별 호출 → headless 자동 변환
    if (cmd.includes("tfx-route.sh")) {
      const parsed = parseRouteCommand(cmd);
      if (parsed) {
        const role = parsed.agent;
        // 프롬프트에서 싱글쿼트 이스케이프
        const safePrompt = parsed.prompt.replace(/'/g, "'\\''");
        const headlessCmd =
          `tfx multi --teammate-mode headless --auto-attach ` +
          `--assign '${parsed.agent}:${safePrompt}:${role}' --timeout 600`;
        autoRoute(
          headlessCmd,
          `[headless-guard] auto-route: tfx-route.sh → headless 변환. 원본 agent=${parsed.agent}, mcp=${parsed.mcp}`,
        );
      }
      // 파싱 실패 시 deny fallback
      deny(
        "[headless-guard] Phase 3 활성 중. tfx-route.sh 명령을 headless로 변환할 수 없습니다. " +
        'Bash("tfx multi --teammate-mode headless --auto-attach --assign \'cli:prompt:role\' ...") 형식을 사용하세요.',
      );
    }
  }

  // ── Agent: CLI 워커 래핑 시도 → deny (tool 타입 변환 불가) ──
  if (toolName === "Agent") {
    const prompt = (toolInput.prompt || "").toLowerCase();
    const desc = (toolInput.description || "").toLowerCase();
    const combined = `${prompt} ${desc}`;

    const cliWorkerPatterns = [
      /codex\s+(exec|run|실행)/,
      /gemini\s+(-p|run|실행)/,
      /tfx-route/,
      /bash.*codex/,
      /bash.*gemini/,
    ];

    if (cliWorkerPatterns.some((p) => p.test(combined))) {
      deny(
        "[headless-guard] Phase 3 활성 중. " +
        "Codex/Gemini를 Agent()로 래핑하지 말고 headless --assign으로 전달하세요. " +
        'Bash("tfx multi --teammate-mode headless --assign \'codex:prompt:role\' ...")',
      );
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));

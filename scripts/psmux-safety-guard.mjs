#!/usr/bin/env node
/**
 * psmux-safety-guard.mjs — PreToolUse 훅
 *
 * psmux kill-session 직접 호출을 차단하고,
 * psmux/wt 명령 사용 시 안전 규칙을 강제 주입한다.
 *
 * 동작:
 * - kill-session 직접 호출 → deny (exit 2)
 * - psmux/wt 명령 감지 → additionalContext에 안전 규칙 주입
 * - 그 외 → 통과 (exit 0)
 */

import { nudge, deny } from "./lib/hook-utils.mjs";

const KILL_PATTERN = /\bpsmux\s+kill-session\b/;
const GRACEFUL_PATTERN = /send-keys.*exit.*Enter[\s\S]*sleep\s+\d/;
const PSMUX_OR_WT = /\b(psmux|wt\.exe|wt\s)/;

const SAFETY_RULES = `[psmux-safety] WT 프리징 방지 필수 규칙:
1) exit → sleep 2 → kill 순서 필수. 바로 kill 절대 금지.
2) psmux send-keys는 PowerShell 구문만 (bash 문법 직접 전달 금지).
3) 경로는 Windows 형식 (C:\\...). /c/... 금지.
4) wt.exe는 sp(split-pane)만 사용. nt(new-tab) 금지.
5) -p triflux 프로파일 필수.`;

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  if (!raw.trim()) process.exit(0);

  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  if (input.tool_name !== "Bash") process.exit(0);

  const cmd = input.tool_input?.command || "";

  // kill-session 직접 호출 감지
  if (KILL_PATTERN.test(cmd)) {
    // 같은 명령 블록 안에 graceful exit 패턴이 있으면 허용
    if (GRACEFUL_PATTERN.test(cmd)) {
      nudge(SAFETY_RULES);
    }
    deny(
      "[psmux-safety] psmux kill-session 직접 호출 차단.\n" +
      "WT 프리징을 방지하려면 반드시 exit → sleep 2 → kill 순서를 따르세요.\n\n" +
      "올바른 패턴:\n" +
      "  psmux send-keys -t SESSION \"exit\" Enter\n" +
      "  sleep 2\n" +
      "  psmux kill-session -t SESSION\n\n" +
      "이 3줄을 하나의 명령 블록으로 실행하세요."
    );
  }

  // psmux/wt 명령 감지 → 안전 규칙 주입
  if (PSMUX_OR_WT.test(cmd)) {
    nudge(SAFETY_RULES);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));

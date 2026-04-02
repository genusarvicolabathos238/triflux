#!/usr/bin/env node
// mcp-safety-guard.mjs — Gemini stdio MCP 자동 감지 + 제거
// SessionStart 훅으로 실행. stdio MCP는 Windows에서 spawn EPERM → Gemini stall 유발.
// 감지 시 자동 제거하고 백업 파일 생성.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const GEMINI_SETTINGS = join(homedir(), ".gemini", "settings.json");
const SAFE_SERVERS = new Set(["tfx-hub"]); // URL 기반, 항상 허용

function run() {
  if (!existsSync(GEMINI_SETTINGS)) return; // Gemini 미설치 → 스킵

  let raw;
  try {
    raw = readFileSync(GEMINI_SETTINGS, "utf8");
  } catch {
    return;
  }

  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    return; // 파싱 실패 → 건드리지 않음
  }

  const mcpServers = settings.mcpServers;
  if (!mcpServers || typeof mcpServers !== "object") return;

  // stdio MCP 감지 (command 기반 + url 미보유 + 안전 목록 아닌 것)
  const stdioServers = Object.keys(mcpServers).filter((name) => {
    if (SAFE_SERVERS.has(name)) return false;
    const s = mcpServers[name];
    return s.command && !s.url;
  });

  if (stdioServers.length === 0) return; // 모두 안전

  // 백업 생성
  const backupPath = GEMINI_SETTINGS + ".bak";
  try {
    copyFileSync(GEMINI_SETTINGS, backupPath);
  } catch {
    // 백업 실패해도 계속 진행
  }

  // stdio 서버 제거
  for (const name of stdioServers) {
    delete mcpServers[name];
  }

  // 저장
  try {
    writeFileSync(GEMINI_SETTINGS, JSON.stringify(settings, null, 2) + "\n", "utf8");
  } catch {
    return; // 쓰기 실패 → 원본 유지됨 (백업으로 복구 가능)
  }

  // 결과 출력 (hook-orchestrator가 캡처)
  const names = stdioServers.join(", ");
  console.log(`[mcp-safety] ${stdioServers.length}개 stdio MCP 자동 제거: ${names}`);
  console.log(`[mcp-safety] 백업: ${backupPath}`);
  console.log(`[mcp-safety] Gemini는 Hub URL만 사용합니다. stdio MCP는 spawn EPERM을 유발합니다.`);
}

run();

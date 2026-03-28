// hub/lib/process-utils.mjs
// 프로세스 관련 공유 유틸리티

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const CLEANUP_SCRIPT_DIR = join(tmpdir(), "tfx-process-utils");
const SCAN_SCRIPT_PATH = join(CLEANUP_SCRIPT_DIR, "scan-processes.ps1");
const TREE_SCRIPT_PATH = join(CLEANUP_SCRIPT_DIR, "get-ancestor-tree.ps1");

// 스크립트 버전 — 내용 변경 시 증가하여 캐시된 스크립트를 갱신
const SCRIPT_VERSION = 2;
const VERSION_FILE = join(CLEANUP_SCRIPT_DIR, ".version");

/**
 * 주어진 PID의 프로세스가 살아있는지 확인한다.
 * EPERM: 프로세스는 존재하지만 signal 권한 없음 → alive
 * ESRCH: 프로세스가 존재하지 않음 → dead
 */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e?.code === 'EPERM') return true;
    if (e?.code === 'ESRCH') return false;
    return false;
  }
}

/**
 * PowerShell 헬퍼 스크립트를 임시 디렉토리에 생성한다.
 * bash의 $_ 이스케이핑 문제를 피하기 위해 -File로 실행.
 */
function ensureHelperScripts() {
  mkdirSync(CLEANUP_SCRIPT_DIR, { recursive: true });

  // 버전 체크 — 스크립트 갱신 필요 여부
  let needsUpdate = true;
  try {
    if (existsSync(VERSION_FILE)) {
      const cached = Number.parseInt(readFileSync(VERSION_FILE, "utf8").trim(), 10);
      if (cached === SCRIPT_VERSION) needsUpdate = false;
    }
  } catch {}

  if (needsUpdate) {
    // 기존 스크립트 삭제 후 재생성
    try { unlinkSync(SCAN_SCRIPT_PATH); } catch {}
    try { unlinkSync(TREE_SCRIPT_PATH); } catch {}
  }

  if (!existsSync(TREE_SCRIPT_PATH)) {
    writeFileSync(TREE_SCRIPT_PATH, [
      "param([int]$StartPid)",
      "$p = $StartPid",
      "for ($i = 0; $i -lt 10; $i++) {",
      "    if ($p -le 0) { break }",
      "    Write-Output $p",
      '    $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue).ParentProcessId',
      "    if ($null -eq $parent -or $parent -le 0) { break }",
      "    $p = $parent",
      "}",
    ].join("\n"), "utf8");
  }

  if (!existsSync(SCAN_SCRIPT_PATH)) {
    // node.exe + bash.exe + cmd.exe 전체를 스캔하여 PID,ParentPID,Name 출력
    writeFileSync(SCAN_SCRIPT_PATH, [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' OR Name='bash.exe' OR Name='cmd.exe'\" | ForEach-Object {",
      '    Write-Output "$($_.ProcessId),$($_.ParentProcessId),$($_.Name)"',
      "}",
    ].join("\n"), "utf8");
  }

  if (needsUpdate) {
    writeFileSync(VERSION_FILE, String(SCRIPT_VERSION), "utf8");
  }
}

/**
 * PID → 루트 조상까지의 체인에서 살아있는 조상이 있는지 확인한다.
 * 프로세스 맵을 사용하여 O(depth) 탐색.
 * @param {number} pid
 * @param {Map<number, {ppid: number, name: string}>} procMap
 * @param {Set<number>} protectedPids
 * @returns {boolean} true = 보호됨 (활성 조상 체인이 있음)
 */
function hasLiveAncestorChain(pid, procMap, protectedPids) {
  const visited = new Set();
  let current = pid;

  while (current > 0 && !visited.has(current)) {
    visited.add(current);

    if (protectedPids.has(current)) return true;

    const info = procMap.get(current);
    if (!info) {
      // 프로세스 맵에 없음 → 살아있는지 직접 확인
      return isPidAlive(current);
    }

    const ppid = info.ppid;
    if (!Number.isFinite(ppid) || ppid <= 0) {
      // 루트 프로세스 (ppid=0) — 시스템 프로세스이므로 보호
      return true;
    }

    // 부모가 맵에 없고 죽었으면 → 고아 체인
    if (!procMap.has(ppid) && !isPidAlive(ppid)) return false;

    current = ppid;
  }

  return false;
}

/**
 * 고아 프로세스 트리를 정리한다 (node.exe + bash.exe + cmd.exe).
 * Windows 전용 — Agent 서브프로세스가 MCP 서버, bash 래퍼, cmd 래퍼를 남기는 문제 대응.
 *
 * 전략: 부모 체인을 루트까지 추적하여, 체인 중간에 죽은 프로세스가 있으면
 * 해당 프로세스 아래의 전체 트리를 고아로 판정하고 정리.
 *
 * 보호 대상: 현재 프로세스 조상 트리, Hub PID
 * @returns {{ killed: number, remaining: number }}
 */
export function cleanupOrphanNodeProcesses() {
  if (process.platform !== "win32") return { killed: 0, remaining: 0 };

  ensureHelperScripts();

  const myPid = process.pid;

  // Hub PID 보호
  let hubPid = null;
  try {
    const hubPidPath = join(homedir(), ".claude", "cache", "tfx-hub", "hub.pid");
    if (existsSync(hubPidPath)) {
      const hubInfo = JSON.parse(readFileSync(hubPidPath, "utf8"));
      hubPid = Number(hubInfo?.pid);
    }
  } catch {}

  // 보호 PID 세트: 현재 프로세스 + Hub + 현재 프로세스의 조상 트리
  const protectedPids = new Set();
  protectedPids.add(myPid);
  if (Number.isFinite(hubPid) && hubPid > 0) protectedPids.add(hubPid);

  try {
    const treeOutput = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${TREE_SCRIPT_PATH}" -StartPid ${myPid}`,
      { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] },
    );
    for (const line of treeOutput.split(/\r?\n/)) {
      const pid = Number.parseInt(line.trim(), 10);
      if (Number.isFinite(pid) && pid > 0) protectedPids.add(pid);
    }
  } catch {}

  // 전체 프로세스 맵 구축 (node + bash + cmd)
  const procMap = new Map();
  try {
    const output = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${SCAN_SCRIPT_PATH}"`,
      { encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] },
    );

    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [pidStr, ppidStr, name] = trimmed.split(",");
      const pid = Number.parseInt(pidStr, 10);
      const ppid = Number.parseInt(ppidStr, 10);
      if (Number.isFinite(pid) && pid > 0) {
        procMap.set(pid, { ppid, name: name || "unknown" });
      }
    }
  } catch {}

  // 고아 판정 + 정리
  let killed = 0;
  for (const [pid, info] of procMap) {
    if (protectedPids.has(pid)) continue;

    // 조상 체인이 살아있으면 건드리지 않음
    if (hasLiveAncestorChain(pid, procMap, protectedPids)) continue;

    // 고아 → 종료
    try {
      process.kill(pid, "SIGTERM");
      killed++;
    } catch {}
  }

  // 남은 프로세스 수 확인
  let remaining = 0;
  try {
    const countOutput = execSync(
      `powershell -NoProfile -Command "(Get-Process node -ErrorAction SilentlyContinue).Count"`,
      { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] },
    );
    remaining = Number.parseInt(countOutput.trim(), 10) || 0;
  } catch {}

  return { killed, remaining };
}

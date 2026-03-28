// hub/lib/process-utils.mjs
// 프로세스 관련 공유 유틸리티

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
 * 부모 프로세스가 죽은 고아 node.exe 프로세스를 정리한다.
 * Windows 전용 — Agent 서브프로세스가 MCP 서버를 남기는 문제 대응.
 *
 * 보호 대상: 현재 프로세스, Hub PID, 살아있는 부모를 가진 프로세스
 * @returns {{ killed: number, remaining: number }}
 */
export function cleanupOrphanNodeProcesses() {
  if (process.platform !== "win32") return { killed: 0, remaining: 0 };

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
    // 현재 프로세스의 조상 트리를 보호 목록에 추가
    const treeOutput = execSync(
      `powershell -NoProfile -Command "$p=${myPid}; for($i=0;$i -lt 10;$i++){if($p -le 0){break}; Write-Output $p; $p=(Get-CimInstance Win32_Process -Filter \\"ProcessId=$p\\").ParentProcessId}"`,
      { encoding: "utf8", timeout: 8000, stdio: ["pipe", "pipe", "pipe"] },
    );
    for (const line of treeOutput.split(/\r?\n/)) {
      const pid = Number.parseInt(line.trim(), 10);
      if (Number.isFinite(pid) && pid > 0) protectedPids.add(pid);
    }
  } catch {}

  let killed = 0;
  try {
    // 부모가 죽은 고아 node.exe 찾기
    const output = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Select-Object ProcessId,ParentProcessId | ForEach-Object { Write-Output \\"\\"$($_.ProcessId),$($_.ParentProcessId)\\" }"`,
      { encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] },
    );

    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim().replace(/^"|"$/g, "");
      if (!trimmed) continue;
      const [pidStr, ppidStr] = trimmed.split(",");
      const pid = Number.parseInt(pidStr, 10);
      const ppid = Number.parseInt(ppidStr, 10);

      if (!Number.isFinite(pid) || pid <= 0) continue;
      if (protectedPids.has(pid)) continue;

      // 부모가 살아있으면 건드리지 않음
      if (Number.isFinite(ppid) && ppid > 0 && isPidAlive(ppid)) continue;

      // 고아 프로세스 종료
      try {
        process.kill(pid, "SIGTERM");
        killed++;
      } catch {}
    }
  } catch {}

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

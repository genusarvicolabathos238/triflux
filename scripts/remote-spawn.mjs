#!/usr/bin/env node
// remote-spawn.mjs — 로컬/원격 Claude 세션 실행 유틸리티
//
// Usage:
//   node remote-spawn.mjs --local [--dir <path>] [--prompt "..."] [--handoff <file>]
//   node remote-spawn.mjs --host <ssh-host> [--dir <path>] [--prompt "..."] [--handoff <file>]

import { execFileSync, spawn } from "child_process";
import { readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { homedir, platform, tmpdir } from "os";

const MAX_HANDOFF_BYTES = 1 * 1024 * 1024; // 1 MB

// ── 입력 검증 ──

const SAFE_HOST_RE = /^[a-zA-Z0-9._-]+$/;
const SAFE_DIR_RE = /^[a-zA-Z0-9_.~\/:\\-]+$/;

function validateHost(host) {
  if (!SAFE_HOST_RE.test(host)) {
    console.error(`invalid host name: ${host}`);
    process.exit(1);
  }
  return host;
}

function validateDir(dir) {
  if (!SAFE_DIR_RE.test(dir)) {
    console.error(`invalid directory path: ${dir}`);
    process.exit(1);
  }
  return dir;
}

function shellQuote(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ── CLI 파싱 ──

function parseArgs(argv) {
  const args = { host: null, dir: null, prompt: null, handoff: null, local: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--local") { args.local = true; continue; }
    if (a === "--host" && argv[i + 1]) { args.host = validateHost(argv[++i]); continue; }
    if (a === "--dir" && argv[i + 1]) { args.dir = validateDir(argv[++i]); continue; }
    if (a === "--prompt" && argv[i + 1]) { args.prompt = argv[++i]; continue; }
    if (a === "--handoff" && argv[i + 1]) { args.handoff = argv[++i]; continue; }
    // 미지정 인자는 prompt로 처리
    if (!args.prompt) args.prompt = a;
  }
  return args;
}

// ── Claude 실행 경로 감지 ──

function detectClaudePath() {
  // 1. 환경변수 오버라이드
  if (process.env.CLAUDE_BIN_PATH) return process.env.CLAUDE_BIN_PATH;

  // 2. WinGet Links
  const wingetPath = join(homedir(), "AppData", "Local", "Microsoft", "WinGet", "Links", "claude.exe");
  if (existsSync(wingetPath)) return wingetPath;

  // 3. npm global
  const npmPath = join(process.env.APPDATA || "", "npm", "claude.cmd");
  if (existsSync(npmPath)) return npmPath;

  // 3. PATH에서 찾기
  try {
    const cmd = platform() === "win32" ? "where" : "which";
    const result = execFileSync(cmd, ["claude"], { encoding: "utf8", timeout: 5000 }).trim();
    if (result) return result.split("\n")[0].trim();
  } catch { /* not found */ }

  return "claude"; // fallback — PATH에 있다고 가정
}

// ── 권한 플래그 ──

function getPermissionFlag() {
  if (process.env.TFX_CLAUDE_SAFE_MODE === "1") return [];
  return ["--dangerously-skip-permissions"];
}

// ── 핸드오프 컨텐츠 생성 ──

function buildPrompt(args) {
  let content = "";

  if (args.handoff) {
    const handoffPath = resolve(args.handoff);
    if (!existsSync(handoffPath)) {
      console.error(`handoff file not found: ${handoffPath}`);
      process.exit(1);
    }
    const size = statSync(handoffPath).size;
    if (size > MAX_HANDOFF_BYTES) {
      console.error(`handoff file too large: ${size} bytes (max ${MAX_HANDOFF_BYTES})`);
      process.exit(1);
    }
    content = readFileSync(handoffPath, "utf8").trim();
  }

  if (args.prompt) {
    content = content ? `${content}\n\n---\n\n${args.prompt}` : args.prompt;
  }

  return content;
}

// ── 로컬 Spawn (WT 탭) ──

function spawnLocal(args, claudePath, prompt) {
  const dir = args.dir ? resolve(args.dir) : process.cwd();

  if (platform() !== "win32") {
    // Linux/macOS: 직접 실행
    const cliArgs = [...getPermissionFlag()];
    if (prompt) cliArgs.push(prompt);

    const child = spawn(claudePath, cliArgs, {
      cwd: dir,
      stdio: "inherit",
    });
    child.on("exit", (code) => process.exit(code || 0));
    return;
  }

  // Windows: wt.exe new-tab
  const wtArgs = ["new-tab", "-d", dir, "--"];
  const claudeForward = claudePath.replace(/\\/g, "/");

  if (prompt) {
    // pwsh single-quote: 내부 ' → '' 이스케이프
    const psQuoted = "'" + prompt.replace(/'/g, "''") + "'";
    wtArgs.push(
      "pwsh", "-NoProfile", "-Command",
      `& '${claudeForward}' ${getPermissionFlag().join(" ")} ${psQuoted}`,
    );
  } else {
    wtArgs.push(claudeForward, ...getPermissionFlag());
  }

  try {
    spawn("wt.exe", wtArgs, { detached: true, stdio: "ignore", windowsHide: false }).unref();
    console.log(`spawned local Claude in WT tab → ${dir}`);
  } catch (err) {
    console.error("wt.exe spawn failed:", err.message);
    process.exit(1);
  }
}

// ── 원격 Spawn (SSH) ──

function spawnRemote(args, prompt) {
  const { host } = args;
  if (!host) {
    console.error("--host required for remote spawn");
    process.exit(1);
  }

  const dir = args.dir || "~";
  const permFlags = getPermissionFlag();

  // 전략: 원격에 .ps1 스크립트 파일 작성 → pwsh -NoExit -File로 실행
  // 인라인 쿼팅 지옥 완전 회피
  const scriptLines = [
    `cd '${dir.replace(/'/g, "''")}'`,
  ];
  if (prompt) {
    const safePrompt = prompt.replace(/'/g, "''");
    scriptLines.push(`& "$env:USERPROFILE\\.local\\bin\\claude.exe" ${permFlags.join(" ")} '${safePrompt}'`);
  } else {
    scriptLines.push(`& "$env:USERPROFILE\\.local\\bin\\claude.exe" ${permFlags.join(" ")}`);
  }
  const scriptContent = scriptLines.join("\n");

  // 1단계: 로컬 임시파일에 스크립트 작성 → scp로 원격 홈에 전송
  const localScript = join(tmpdir(), "tfx-remote-spawn.ps1");
  writeFileSync(localScript, scriptContent, "utf8");

  try {
    execFileSync("scp", [localScript, `${host}:tfx-remote-spawn.ps1`], { timeout: 10000, stdio: "pipe" });
  } catch (err) {
    console.error("failed to copy script to remote:", err.message);
    process.exit(1);
  }

  // 2단계: 원격 홈 디렉토리 절대경로 취득 → WT에서 ~ 확장 안 되므로
  let remoteHome;
  try {
    remoteHome = execFileSync("ssh", [host, "echo", "$env:USERPROFILE"], { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    remoteHome = "C:\\Users\\" + host; // fallback
  }
  const remoteScript = remoteHome.replace(/\\/g, "/") + "/tfx-remote-spawn.ps1";
  const remoteCmd = `pwsh -NoExit -File ${remoteScript}`;

  if (platform() === "win32") {
    const wtArgs = [
      "new-tab", "--title", `Claude@${host}`, "--",
      "ssh", "-t", "--", host, remoteCmd,
    ];
    try {
      spawn("wt.exe", wtArgs, { detached: true, stdio: "ignore", windowsHide: false }).unref();
      console.log(`spawned remote Claude → ${host}:${dir}`);
    } catch (err) {
      console.error("wt.exe spawn failed:", err.message);
      process.exit(1);
    }
  } else {
    const child = spawn("ssh", ["-t", "--", host, remoteCmd], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  }
}

// ── main ──

function main() {
  const args = parseArgs(process.argv);

  if (!args.local && !args.host) {
    console.log(`Usage:
  remote-spawn --local [--dir <path>] [--prompt "task"] [--handoff <file>]
  remote-spawn --host <ssh-host> [--dir <path>] [--prompt "task"] [--handoff <file>]

Options:
  --local          로컬 WT 탭에서 Claude 실행
  --host <name>    SSH 호스트로 원격 Claude 실행
  --dir <path>     작업 디렉토리 (기본: 현재 디렉토리 / ~)
  --prompt "..."   Claude에 전달할 첫 메시지
  --handoff <file> 핸드오프 파일 경로 (prompt와 결합 가능)`);
    process.exit(0);
  }

  const prompt = buildPrompt(args);
  const claudePath = detectClaudePath();

  if (args.local) {
    spawnLocal(args, claudePath, prompt);
  } else {
    spawnRemote(args, prompt);
  }
}

main();

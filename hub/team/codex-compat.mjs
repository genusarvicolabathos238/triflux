// hub/team/codex-compat.mjs — Codex CLI 버전 어댑터
// Codex 0.117.0+ (Rust 리라이트): exec 서브커맨드 기반
import { execSync } from "node:child_process";

let _cachedVersion = null;

/**
 * `codex --version` 실행 결과를 파싱하여 마이너 버전 숫자 반환.
 * 파싱 실패 시 0 반환 (구버전으로 간주).
 * @returns {number} 마이너 버전 (예: 0.117.0 → 117)
 */
export function getCodexVersion() {
  if (_cachedVersion !== null) return _cachedVersion;
  try {
    const out = execSync("codex --version", { encoding: "utf8", timeout: 5000 }).trim();
    // "codex 0.117.0" 또는 "0.117.0" 형식 대응
    const m = out.match(/(\d+)\.(\d+)\.(\d+)/);
    _cachedVersion = m ? parseInt(m[2], 10) : 0;
  } catch {
    _cachedVersion = 0;
  }
  return _cachedVersion;
}

/**
 * 최소 마이너 버전 이상인지 확인.
 * @param {number} minMinor
 * @returns {boolean}
 */
export function gte(minMinor) {
  return getCodexVersion() >= minMinor;
}

/**
 * Codex CLI 기능별 분기 객체.
 * 117 = 0.117.0 (Rust 리라이트, exec 서브커맨드 도입)
 */
export const FEATURES = {
  /** exec 서브커맨드 사용 가능 여부 */
  get execSubcommand() { return gte(117); },
  /** --output-last-message 플래그 지원 여부 */
  get outputLastMessage() { return gte(117); },
  /** --color never 플래그 지원 여부 */
  get colorNever() { return gte(117); },
  /** 플러그인 시스템 지원 여부 (향후 확장용) */
  get pluginSystem() { return gte(120); },
};

/**
 * long-form 플래그 기반 명령 빌더.
 * @param {string} prompt
 * @param {string|null} resultFile — null이면 --output-last-message 생략
 * @param {{ profile?: string, skipGitRepoCheck?: boolean, sandboxBypass?: boolean }} [opts]
 * @returns {string} 실행할 셸 커맨드
 */
export function buildExecCommand(prompt, resultFile = null, opts = {}) {
  const { profile, skipGitRepoCheck = true, sandboxBypass = true } = opts;

  const parts = ["codex"];
  if (profile) parts.push("--profile", profile);

  if (FEATURES.execSubcommand) {
    parts.push("exec");
    if (sandboxBypass) parts.push("--dangerously-bypass-approvals-and-sandbox");
    if (skipGitRepoCheck) parts.push("--skip-git-repo-check");
    if (resultFile && FEATURES.outputLastMessage) {
      parts.push("--output-last-message", resultFile);
    }
    if (FEATURES.colorNever) parts.push("--color", "never");
  } else {
    // 구버전 fallback
    parts.push("--dangerously-bypass-approvals-and-sandbox");
    if (skipGitRepoCheck) parts.push("--skip-git-repo-check");
  }

  parts.push(JSON.stringify(prompt));
  return parts.join(" ");
}

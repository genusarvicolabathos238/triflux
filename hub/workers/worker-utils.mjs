// hub/workers/worker-utils.mjs — 워커 공통 유틸리티
// claude-worker, gemini-worker, pipe 등에서 공유하는 순수 유틸 함수 모음.

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
export const DEFAULT_KILL_GRACE_MS = 1000;

export function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

export function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function createWorkerError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

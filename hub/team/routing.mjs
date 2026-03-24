/**
 * 라우팅 결정 함수
 * @param {object} opts
 * @param {Array<{id:string, description?:string, agent?:string, depends_on?:string[], complexity?:string}>} opts.subtasks
 * @param {string} opts.graph_type - "INDEPENDENT" | "SEQUENTIAL" | "DAG"
 * @param {boolean} opts.thorough - thorough 모드 여부
 * @returns {{
 *   strategy: "quick_single" | "thorough_single" | "quick_team" | "thorough_team" | "batch_single",
 *   reason: string,
 *   dag_width: number,
 *   max_complexity: string
 * }}
 */
export function resolveRoutingStrategy({ subtasks, graph_type, thorough }) {
  const N = subtasks.length;
  if (N === 0) {
    return { strategy: 'quick_single', reason: 'empty_subtasks', dag_width: 0, max_complexity: 'S' };
  }

  const dag_width = computeDagWidth(subtasks, graph_type);
  const max_complexity = getMaxComplexity(subtasks);
  const isHighComplexity = ['L', 'XL'].includes(max_complexity);
  const allSameAgent = new Set(subtasks.map((s) => s.agent)).size === 1;
  const allSmall = subtasks.every((s) => normalizeComplexity(s.complexity) === 'S');

  // N==1: 단일 태스크
  if (N === 1) {
    if (thorough || isHighComplexity) {
      return {
        strategy: 'thorough_single',
        reason: 'single_high_complexity',
        dag_width,
        max_complexity,
      };
    }
    return {
      strategy: 'quick_single',
      reason: 'single_low_complexity',
      dag_width,
      max_complexity,
    };
  }

  // dag_width==1: 사실상 순차 -> single
  if (dag_width === 1) {
    if (thorough || isHighComplexity) {
      return {
        strategy: 'thorough_single',
        reason: 'sequential_chain',
        dag_width,
        max_complexity,
      };
    }
    return {
      strategy: 'quick_single',
      reason: 'sequential_chain',
      dag_width,
      max_complexity,
    };
  }

  // 동일 에이전트 + 모두 S: 프롬프트 병합 -> batch single
  if (allSameAgent && allSmall) {
    return {
      strategy: 'batch_single',
      reason: 'same_agent_small_batch',
      dag_width,
      max_complexity,
    };
  }

  // dag_width >= 2: 팀
  if (thorough || isHighComplexity) {
    return {
      strategy: 'thorough_team',
      reason: 'parallel_high_complexity',
      dag_width,
      max_complexity,
    };
  }
  return {
    strategy: 'quick_team',
    reason: 'parallel_low_complexity',
    dag_width,
    max_complexity,
  };
}

/**
 * DAG 폭 계산 - 레벨별 최대 병렬 태스크 수
 * @param {Array<{id:string, depends_on?:string[]}>} subtasks
 * @param {string} graph_type
 * @returns {number}
 */
function computeDagWidth(subtasks, graph_type) {
  if (graph_type === 'SEQUENTIAL') return 1;
  if (graph_type === 'INDEPENDENT') return subtasks.length;

  // DAG: 레벨별 계산 (순환 의존 방어)
  const levels = {};
  const visiting = new Set();

  function getLevel(task) {
    if (levels[task.id] !== undefined) return levels[task.id];
    if (visiting.has(task.id)) {
      levels[task.id] = 0; // 순환 끊기
      return 0;
    }
    if (!task.depends_on || task.depends_on.length === 0) {
      levels[task.id] = 0;
      return 0;
    }
    visiting.add(task.id);
    const depLevels = task.depends_on.map((depId) => {
      const dep = subtasks.find((s) => s.id === depId);
      return dep ? getLevel(dep) : 0;
    });
    visiting.delete(task.id);
    levels[task.id] = Math.max(...depLevels) + 1;
    return levels[task.id];
  }

  subtasks.forEach(getLevel);

  const levelCounts = {};
  for (const level of Object.values(levels)) {
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  }
  return Math.max(...Object.values(levelCounts), 1);
}

/**
 * 최대 복잡도 추출
 * @param {Array<{complexity?:string}>} subtasks
 * @returns {"S" | "M" | "L" | "XL"}
 */
function getMaxComplexity(subtasks) {
  const order = { S: 0, M: 1, L: 2, XL: 3 };
  let max = 'S';
  for (const s of subtasks) {
    const complexity = normalizeComplexity(s.complexity);
    if (order[complexity] > order[max]) max = complexity;
  }
  return max;
}

/**
 * complexity 기본값 보정
 * @param {string | undefined} complexity
 * @returns {"S" | "M" | "L" | "XL"}
 */
function normalizeComplexity(complexity) {
  return ['S', 'M', 'L', 'XL'].includes(complexity) ? complexity : 'M';
}

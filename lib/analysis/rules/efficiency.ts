import ts from 'typescript';
import type { Finding } from '../types';

/**
 * Detects known inefficiency patterns in JavaScript and TypeScript.
 *
 * What this is NOT: a benchmark. Measuring real runtime would mean executing
 * code from an arbitrary repository on the server, which this project
 * deliberately never does. Everything here is derived from the syntax tree, so
 * it identifies *shapes* that are reliably slow — a linear scan nested inside a
 * loop is quadratic whether or not anyone ever runs it.
 *
 * The consequence worth stating in the UI: a clean report means "no known slow
 * pattern was found", not "this code is fast".
 */

const SUPPORTED = /\.(?:[jt]sx?|mjs|cjs|mts|cts)$/i;
const TEST_FILE =
  /(?:^|\/)(?:__tests__|__mocks__|tests?|specs?|e2e|cypress)\/|\.(?:test|spec)\.[jt]sx?$/i;
const NOT_AUTHORED =
  /(?:^|\/)(?:node_modules|vendor|dist|build|out|\.next|coverage)\/|\.min\.[jt]s$|\.d\.ts$/i;

export function supportsEfficiency(path: string): boolean {
  return SUPPORTED.test(path) && !TEST_FILE.test(path) && !NOT_AUTHORED.test(path);
}

/** Methods that scan a collection from the start: O(n) each call. */
const LINEAR_SCAN = new Set([
  'includes',
  'indexOf',
  'lastIndexOf',
  'find',
  'findIndex',
  'filter',
  'some',
  'every',
]);

/** Array mutations that reindex every element: O(n) each call. */
const REINDEXING = new Set(['shift', 'unshift']);

interface Ctx {
  source: ts.SourceFile;
  path: string;
  findings: Finding[];
  /** One report per rule per enclosing function keeps output actionable. */
  seen: Set<string>;
}

function lineOf(ctx: Ctx, node: ts.Node): number {
  return ctx.source.getLineAndCharacterOfPosition(node.getStart(ctx.source)).line + 1;
}

function snippet(ctx: Ctx, node: ts.Node): string {
  const text = node.getText(ctx.source).replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

/** `.forEach`/`.map`/`.reduce` iterate too, even though they are calls. */
function isIteratingCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const name = node.expression.name.text;
  return ['forEach', 'map', 'reduce', 'flatMap'].includes(name);
}

function calledMethod(node: ts.Node): string | null {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  return node.expression.name.text;
}

function add(ctx: Ctx, key: string, finding: Omit<Finding, 'source' | 'confidence'>) {
  if (ctx.seen.has(key)) return;
  ctx.seen.add(key);
  ctx.findings.push({ ...finding, source: 'engine', confidence: 1 });
}

function analyse(ctx: Ctx) {
  const walk = (node: ts.Node, loopDepth: number, fnKey: string) => {
    let nextDepth = loopDepth;

    if (isFunctionNode(node)) {
      fnKey = `${ctx.path}:${lineOf(ctx, node)}`;
      // A function defined inside a loop starts its own nesting count only for
      // callbacks that are not themselves iteration (those are handled below).
    }

    const iterating = isLoop(node) || isIteratingCall(node);
    if (iterating) {
      nextDepth = loopDepth + 1;

      if (nextDepth >= 2) {
        const order = nextDepth >= 3 ? 'O(n³)' : 'O(n²)';
        add(ctx, `nested-loop:${fnKey}:${nextDepth}`, {
          ruleId: 'efficiency/nested-loops',
          category: 'OPTIMIZATION',
          severity: nextDepth >= 3 ? 'HIGH' : 'MEDIUM',
          title: `Nested iteration ${nextDepth} levels deep — roughly ${order}`,
          description: `This loop runs inside ${nextDepth - 1} other ${nextDepth === 2 ? 'loop' : 'loops'}, so the work grows as ${order} of the input size. At 1,000 items that is ${nextDepth >= 3 ? 'a billion' : 'a million'} operations.`,
          file: ctx.path,
          line: lineOf(ctx, node),
          evidence: snippet(ctx, node),
          remediation:
            'Where the inner loop is searching, build a Set or Map of the inner collection once before the outer loop and look up in O(1). Where it is pairing data, consider a single pass with an index.',
        });
      }
    }

    // --- Linear scan inside a loop: the classic accidental O(n²) ---
    const method = calledMethod(node);
    if (
      method &&
      loopDepth >= 1 &&
      LINEAR_SCAN.has(method) &&
      searchesDynamicValue(ctx, node) &&
      !hasStringReceiver(ctx, node)
    ) {
      add(ctx, `linear-scan:${fnKey}:${method}`, {
        ruleId: 'efficiency/linear-search-in-loop',
        category: 'OPTIMIZATION',
        severity: 'HIGH',
        title: `\`.${method}()\` called inside a loop — O(n²)`,
        description: `\`.${method}()\` scans the collection from the beginning on every call. Calling it inside a loop makes the whole operation quadratic.`,
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation: `Build a \`Set\` or \`Map\` from the collection once before the loop, then use \`.has()\` or \`.get()\`, which are O(1).`,
      });
    }

    if (method && loopDepth >= 1 && REINDEXING.has(method)) {
      add(ctx, `reindex:${fnKey}:${method}`, {
        ruleId: 'efficiency/array-reindex-in-loop',
        category: 'OPTIMIZATION',
        severity: 'MEDIUM',
        title: `\`.${method}()\` inside a loop reindexes the whole array`,
        description: `\`.${method}()\` moves every remaining element, so using it in a loop is O(n²).`,
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation:
          method === 'shift'
            ? 'Iterate forward with an index instead of consuming the array, or use a deque-style pointer.'
            : 'Push onto the end and reverse once at the end, which is O(n) overall.',
      });
    }

    if (method === 'sort' && loopDepth >= 1) {
      add(ctx, `sort:${fnKey}`, {
        ruleId: 'efficiency/sort-in-loop',
        category: 'OPTIMIZATION',
        severity: 'HIGH',
        title: 'Sorting inside a loop — O(n² log n)',
        description:
          'Each sort is O(n log n); running one on every iteration multiplies that by the loop length.',
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation: 'Sort once before the loop, or keep the data ordered as it is built.',
      });
    }

    // --- Sequential awaits ---
    if (ts.isAwaitExpression(node) && loopDepth >= 1) {
      add(ctx, `await:${fnKey}`, {
        ruleId: 'efficiency/await-in-loop',
        category: 'OPTIMIZATION',
        severity: 'HIGH',
        title: 'await inside a loop runs requests one at a time',
        description:
          'Each iteration waits for the previous one to finish. With 50 items and 100ms per call this takes 5 seconds instead of roughly 100ms.',
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation:
          'Collect the promises and await them together with `Promise.all`, or `Promise.allSettled` when individual failures are acceptable. Keep it sequential only if each iteration genuinely depends on the previous one, or to respect a rate limit.',
      });
    }

    // --- Accumulating by copying ---
    if (ts.isBinaryExpression(node) && loopDepth >= 1) {
      const op = node.operatorToken.kind;

      // arr = [...arr, x]  /  obj = {...obj, k: v}
      if (op === ts.SyntaxKind.EqualsToken) {
        const rhs = node.right;
        const copiesSelf =
          (ts.isArrayLiteralExpression(rhs) || ts.isObjectLiteralExpression(rhs)) &&
          rhs.getText(ctx.source).includes('...');
        if (copiesSelf) {
          add(ctx, `spread:${fnKey}`, {
            ruleId: 'efficiency/spread-accumulation',
            category: 'OPTIMIZATION',
            severity: 'HIGH',
            title: 'Rebuilding a collection by spreading it each iteration — O(n²)',
            description:
              'Spreading copies every existing element on each pass, so building n items costs n²/2 copies.',
            file: ctx.path,
            line: lineOf(ctx, node),
            evidence: snippet(ctx, node),
            remediation:
              'Mutate the accumulator instead: `arr.push(x)` for arrays, `obj[k] = v` or a `Map` for objects. Both are O(1) per item.',
          });
        }
      }

      // s += ... inside a loop, for string building
      if (op === ts.SyntaxKind.PlusEqualsToken && ts.isStringLiteralLike(node.right)) {
        add(ctx, `concat:${fnKey}`, {
          ruleId: 'efficiency/string-concat-in-loop',
          category: 'OPTIMIZATION',
          severity: 'LOW',
          title: 'Building a string by repeated concatenation in a loop',
          description:
            'Modern engines optimise this well, but collecting parts and joining once is clearer and predictable.',
          file: ctx.path,
          line: lineOf(ctx, node),
          evidence: snippet(ctx, node),
          remediation: 'Push the pieces into an array and call `.join("")` once at the end.',
        });
      }
    }

    // --- Deep clone via JSON round-trip ---
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'parse' &&
      node.expression.expression.getText(ctx.source) === 'JSON' &&
      node.arguments[0]?.getText(ctx.source).startsWith('JSON.stringify')
    ) {
      add(ctx, `jsonclone:${fnKey}:${lineOf(ctx, node)}`, {
        ruleId: 'efficiency/json-deep-clone',
        category: 'OPTIMIZATION',
        severity: loopDepth >= 1 ? 'HIGH' : 'MEDIUM',
        title: 'Deep clone via JSON.parse(JSON.stringify(...))',
        description: `Serialising to a string and parsing it back is slow, and it silently drops \`undefined\`, functions, \`Date\` objects, \`Map\`, \`Set\`, and circular references.${loopDepth >= 1 ? ' Inside a loop the cost multiplies.' : ''}`,
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation: 'Use `structuredClone()`, which is faster and preserves those types.',
      });
    }

    // --- Regex recompiled every iteration ---
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'RegExp' &&
      loopDepth >= 1
    ) {
      add(ctx, `regex:${fnKey}`, {
        ruleId: 'efficiency/regex-in-loop',
        category: 'OPTIMIZATION',
        severity: 'MEDIUM',
        title: 'Regular expression compiled inside a loop',
        description: 'The pattern is recompiled on every iteration rather than once.',
        file: ctx.path,
        line: lineOf(ctx, node),
        evidence: snippet(ctx, node),
        remediation: 'Hoist the expression above the loop, or use a literal so it is cached.',
      });
    }

    ts.forEachChild(node, (child) => walk(child, nextDepth, fnKey));
  };

  walk(ctx.source, 0, `${ctx.path}:top`);
}

/**
 * Distinguishes the quadratic pattern from cheap string work.
 *
 * `set.includes(item)` inside a loop is the accidental O(n²) worth reporting.
 * `path.indexOf("/")` is a fixed-substring search on a short string, and
 * flagging it is the kind of noise that teaches people to ignore the tool.
 * Without a type checker the signal is the argument: searching for a *literal*
 * is almost always string work, searching for a *variable* is almost always a
 * collection lookup.
 */
function searchesDynamicValue(ctx: Ctx, node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const args = node.arguments;
  if (args.length === 0) return false;

  return args.some((arg) => {
    if (ts.isStringLiteralLike(arg) || ts.isNumericLiteral(arg)) return false;
    // An inline predicate (`.find(y => y === x)`) is still a linear scan.
    return true;
  });
}

/** Receivers that are plainly strings, by literal or by conventional name. */
const STRING_NAME = /^(?:.*(?:path|url|uri|str|text|line|name|key|slug|query|href|src|id)|s)$/i;

function hasStringReceiver(ctx: Ctx, node: ts.Node): boolean {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const receiver = node.expression.expression;

  if (ts.isStringLiteralLike(receiver) || ts.isTemplateExpression(receiver)) return true;
  if (ts.isIdentifier(receiver)) return STRING_NAME.test(receiver.text);
  return false;
}

function isFunctionNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

export interface EfficiencyReport {
  path: string;
  findings: Finding[];
  /** 0-100, where 100 means no known slow pattern was found. */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Coarse worst-case complexity implied by the findings. */
  estimatedComplexity: string;
  parsed: boolean;
}

/** Weights reflect how much each pattern actually costs at scale. */
const PENALTY: Record<string, number> = {
  'efficiency/nested-loops': 18,
  'efficiency/linear-search-in-loop': 22,
  'efficiency/sort-in-loop': 20,
  'efficiency/await-in-loop': 20,
  'efficiency/spread-accumulation': 18,
  'efficiency/array-reindex-in-loop': 12,
  'efficiency/json-deep-clone': 8,
  'efficiency/regex-in-loop': 6,
  'efficiency/string-concat-in-loop': 3,
};

function gradeFor(score: number): EfficiencyReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function analyseEfficiency(path: string, text: string): EfficiencyReport {
  if (!supportsEfficiency(path)) {
    return {
      path,
      findings: [],
      score: 100,
      grade: 'A',
      estimatedComplexity: 'not analysed',
      parsed: false,
    };
  }

  let source: ts.SourceFile;
  try {
    source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      /\.tsx$/i.test(path)
        ? ts.ScriptKind.TSX
        : /\.jsx$/i.test(path)
          ? ts.ScriptKind.JSX
          : /\.[cm]?ts$/i.test(path)
            ? ts.ScriptKind.TS
            : ts.ScriptKind.JS,
    );
  } catch {
    return {
      path,
      findings: [],
      score: 100,
      grade: 'A',
      estimatedComplexity: 'could not parse',
      parsed: false,
    };
  }

  const ctx: Ctx = { source, path, findings: [], seen: new Set() };
  analyse(ctx);

  const score = Math.max(
    0,
    100 - ctx.findings.reduce((sum, f) => sum + (PENALTY[f.ruleId] ?? 5), 0),
  );

  const worst = ctx.findings.some(
    (f) => f.ruleId === 'efficiency/sort-in-loop' || f.title.includes('O(n³)'),
  )
    ? 'O(n³) or worse'
    : ctx.findings.some(
          (f) =>
            f.ruleId === 'efficiency/nested-loops' ||
            f.ruleId === 'efficiency/linear-search-in-loop' ||
            f.ruleId === 'efficiency/spread-accumulation',
        )
      ? 'O(n²)'
      : 'no super-linear pattern detected';

  return {
    path,
    findings: ctx.findings,
    score,
    grade: gradeFor(score),
    estimatedComplexity: worst,
    parsed: true,
  };
}

import ts from 'typescript';
import type { Finding } from '../types';

/**
 * Structural metrics for JavaScript and TypeScript, computed from the syntax
 * tree of the changed files.
 *
 * Safety: this uses `ts.createSourceFile`, which *parses* text into an AST and
 * nothing more. No module is loaded, no configuration from the target
 * repository is read, and no code from it is ever executed. That distinction
 * matters — running the repository's own ESLint or build config would mean
 * executing arbitrary code from a stranger's repository on the server.
 */

const SUPPORTED = /\.(?:[jt]sx?|mjs|cjs|mts|cts)$/i;

/**
 * Test files are excluded from these metrics. A `describe` block is one giant
 * arrow function by construction, so length and nesting thresholds fire on
 * every well-written suite. A rule that is wrong on healthy code teaches people
 * to ignore the tool.
 */
const TEST_FILE =
  /(?:^|\/)(?:__tests__|__mocks__|tests?|specs?|e2e|cypress)\/|\.(?:test|spec)\.[jt]sx?$/i;

/** Generated and vendored code is not the author's to restructure. */
const NOT_AUTHORED =
  /(?:^|\/)(?:node_modules|vendor|dist|build|out|\.next|coverage)\/|\.min\.[jt]s$|\.d\.ts$|(?:^|\/)generated(?:\/|\.)/i;

const THRESHOLDS = {
  complexity: { medium: 15, high: 25 },
  lines: { medium: 80, high: 160 },
  nesting: { medium: 5, high: 7 },
  params: { low: 6 },
};

export interface SourceFileInput {
  path: string;
  text: string;
}

export function supportsComplexity(path: string): boolean {
  return SUPPORTED.test(path) && !TEST_FILE.test(path) && !NOT_AUTHORED.test(path);
}

function scriptKind(path: string): ts.ScriptKind {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(path)) return ts.ScriptKind.JSX;
  if (/\.[cm]?ts$/i.test(path)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

interface FunctionInfo {
  name: string;
  line: number;
  endLine: number;
  complexity: number;
  nesting: number;
  params: number;
}

function isFunctionNode(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

/** Best-effort readable name, including for anonymous functions bound to a variable. */
function functionName(node: ts.Node): string {
  const named = node as ts.FunctionDeclaration;
  if (named.name && ts.isIdentifier(named.name)) return named.name.text;

  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  return '(anonymous)';
}

/** Nodes that branch, each adding one independent path. */
function isDecisionPoint(node: ts.Node): boolean {
  switch (node.kind) {
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.CatchClause:
    case ts.SyntaxKind.ConditionalExpression:
      return true;
    case ts.SyntaxKind.CaseClause:
      // `default` carries no condition, so it adds no path.
      return true;
    case ts.SyntaxKind.BinaryExpression: {
      const op = (node as ts.BinaryExpression).operatorToken.kind;
      return (
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken
      );
    }
    default:
      return false;
  }
}

/** Control structures that visually indent the code. */
function isNestingNode(node: ts.Node): boolean {
  switch (node.kind) {
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.SwitchStatement:
    case ts.SyntaxKind.TryStatement:
      return true;
    default:
      return false;
  }
}

function analyseFunctions(source: ts.SourceFile): FunctionInfo[] {
  const results: FunctionInfo[] = [];

  const visitFunction = (fn: ts.Node) => {
    let complexity = 1;
    let maxNesting = 0;

    const walk = (node: ts.Node, depth: number) => {
      // A nested function is measured on its own, not folded into its parent.
      if (node !== fn && isFunctionNode(node)) return;

      if (isDecisionPoint(node)) complexity += 1;

      const nextDepth = isNestingNode(node) ? depth + 1 : depth;
      if (nextDepth > maxNesting) maxNesting = nextDepth;

      ts.forEachChild(node, (child) => walk(child, nextDepth));
    };

    ts.forEachChild(fn, (child) => walk(child, 0));

    const start = source.getLineAndCharacterOfPosition(fn.getStart(source)).line + 1;
    const end = source.getLineAndCharacterOfPosition(fn.getEnd()).line + 1;

    results.push({
      name: functionName(fn),
      line: start,
      endLine: end,
      complexity,
      nesting: maxNesting,
      params: (fn as ts.FunctionDeclaration).parameters?.length ?? 0,
    });
  };

  const traverse = (node: ts.Node) => {
    if (isFunctionNode(node)) visitFunction(node);
    ts.forEachChild(node, traverse);
  };

  traverse(source);
  return results;
}

/**
 * Only functions overlapping `changedLines` are reported, so a small change to
 * a legacy file does not bury the author in findings about code they did not
 * touch. Pass an empty set to report on the whole file.
 */
export function complexityRules(
  files: SourceFileInput[],
  changedLinesByFile: Map<string, Set<number>>,
): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!supportsComplexity(file.path)) continue;

    let source: ts.SourceFile;
    try {
      source = ts.createSourceFile(
        file.path,
        file.text,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        scriptKind(file.path),
      );
    } catch {
      // An unparseable file is not a finding; it may simply use syntax this
      // parser does not know. Skip it rather than reporting a false problem.
      continue;
    }

    const changed = changedLinesByFile.get(file.path);

    for (const fn of analyseFunctions(source)) {
      if (changed && changed.size > 0) {
        let overlaps = false;
        for (let l = fn.line; l <= fn.endLine; l++) {
          if (changed.has(l)) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) continue;
      }

      const label = `\`${fn.name}\` in ${file.path}`;
      const length = fn.endLine - fn.line + 1;

      if (fn.complexity >= THRESHOLDS.complexity.medium) {
        findings.push({
          ruleId: 'complexity/cyclomatic',
          source: 'engine',
          category: 'COMPLEXITY',
          severity: fn.complexity >= THRESHOLDS.complexity.high ? 'HIGH' : 'MEDIUM',
          title: `${fn.name} has cyclomatic complexity ${fn.complexity}`,
          description: `${label} has ${fn.complexity} independent paths through it. Every path is a case that needs a test, and complexity above about ${THRESHOLDS.complexity.medium} correlates strongly with defect rate.`,
          file: file.path,
          line: fn.line,
          remediation:
            'Extract the branches into named helper functions, or replace a chain of conditionals with a lookup table or early returns.',
          confidence: 1,
        });
      }

      if (length >= THRESHOLDS.lines.medium) {
        findings.push({
          ruleId: 'complexity/function-length',
          source: 'engine',
          category: 'COMPLEXITY',
          severity: length >= THRESHOLDS.lines.high ? 'HIGH' : 'MEDIUM',
          title: `${fn.name} is ${length} lines long`,
          description: `${label} spans ${length} lines (${fn.line}–${fn.endLine}). Functions this long usually do several unrelated things and are hard to test in isolation.`,
          file: file.path,
          line: fn.line,
          remediation: 'Split it along its internal sections into separate functions.',
          confidence: 1,
        });
      }

      if (fn.nesting >= THRESHOLDS.nesting.medium) {
        findings.push({
          ruleId: 'complexity/nesting-depth',
          source: 'engine',
          category: 'COMPLEXITY',
          severity: fn.nesting >= THRESHOLDS.nesting.high ? 'HIGH' : 'MEDIUM',
          title: `${fn.name} nests ${fn.nesting} levels deep`,
          description: `${label} reaches a nesting depth of ${fn.nesting}. Deeply nested control flow is difficult to follow and easy to get wrong.`,
          file: file.path,
          line: fn.line,
          remediation:
            'Use guard clauses to return early, or extract the inner blocks into their own functions.',
          confidence: 1,
        });
      }

      if (fn.params >= THRESHOLDS.params.low) {
        findings.push({
          ruleId: 'complexity/parameter-count',
          source: 'engine',
          category: 'COMPLEXITY',
          severity: 'LOW',
          title: `${fn.name} takes ${fn.params} parameters`,
          description: `${label} accepts ${fn.params} parameters. Long positional parameter lists are easy to pass in the wrong order.`,
          file: file.path,
          line: fn.line,
          remediation: 'Group related parameters into a single options object.',
          confidence: 1,
        });
      }
    }
  }

  return findings;
}

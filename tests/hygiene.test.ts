import { describe, expect, it } from 'vitest';
import { parseDiff } from '@/lib/diff';
import { hygieneRules } from '@/lib/analysis/rules/hygiene';

function diffAdding(path: string, ...lines: string[]): string {
  const body = lines.map((l) => `+${l}`).join('\n');
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,0 +1,${lines.length} @@\n${body}\n`;
}

function run(path: string, ...lines: string[]) {
  return hygieneRules(parseDiff(diffAdding(path, ...lines)));
}

const ids = (path: string, ...lines: string[]) => run(path, ...lines).map((f) => f.ruleId);

describe('debug statements', () => {
  it('flags console.log', () => {
    expect(ids('src/a.ts', 'console.log("here");')).toContain('hygiene/debug-statement');
  });

  it('flags a debugger statement', () => {
    expect(ids('src/a.ts', '  debugger;')).toContain('hygiene/debug-statement');
  });

  it('rates debugger higher than console.log', () => {
    const [debuggerFinding] = run('src/a.ts', 'debugger;');
    const [logFinding] = run('src/b.ts', 'console.log(1);');
    expect(debuggerFinding?.severity).toBe('HIGH');
    expect(logFinding?.severity).toBe('MEDIUM');
  });

  it('does not flag console.error, which is legitimate logging', () => {
    expect(ids('src/a.ts', 'console.error("failed");')).not.toContain('hygiene/debug-statement');
  });
});

describe('forbidden files', () => {
  it('flags a committed .env file', () => {
    const findings = run('.env', 'SECRET=1');
    expect(findings[0]?.ruleId).toBe('hygiene/forbidden-file');
    expect(findings[0]?.severity).toBe('CRITICAL');
  });

  it('flags a private key file', () => {
    expect(ids('certs/server.pem', 'x')).toContain('hygiene/forbidden-file');
  });

  it('does not flag .env.example', () => {
    expect(ids('.env.example', 'SECRET=')).not.toContain('hygiene/forbidden-file');
  });
});

describe('merge conflict markers', () => {
  it('flags an unresolved conflict as critical', () => {
    const findings = run('src/a.ts', '<<<<<<< HEAD');
    expect(findings[0]?.ruleId).toBe('hygiene/merge-conflict-marker');
    expect(findings[0]?.severity).toBe('CRITICAL');
  });
});

describe('test coverage heuristic', () => {
  it('flags source changes with no test changes', () => {
    expect(ids('src/a.ts', 'const x = 1;')).toContain('hygiene/no-tests-touched');
  });

  it('stays quiet when a test file is also touched', () => {
    const diff =
      diffAdding('src/a.ts', 'const x = 1;') +
      diffAdding('src/a.test.ts', 'it("works", () => {});');
    const findings = hygieneRules(parseDiff(diff)).map((f) => f.ruleId);
    expect(findings).not.toContain('hygiene/no-tests-touched');
  });

  it('stays quiet for a docs-only change', () => {
    expect(ids('README.md', 'Some documentation.')).not.toContain('hygiene/no-tests-touched');
  });
});

describe('change size', () => {
  it('flags a very large diff', () => {
    const lines = Array.from({ length: 600 }, (_, i) => `const v${i} = ${i};`);
    expect(ids('src/big.ts', ...lines)).toContain('hygiene/large-change');
  });

  it('stays quiet for a small diff', () => {
    expect(ids('src/a.ts', 'const x = 1;')).not.toContain('hygiene/large-change');
  });
});

describe('TODO markers', () => {
  it('reports an added TODO at INFO severity', () => {
    const finding = run('src/a.ts', '// TODO: handle the error case').find(
      (f) => f.ruleId === 'hygiene/todo-added',
    );
    expect(finding?.severity).toBe('INFO');
  });
});

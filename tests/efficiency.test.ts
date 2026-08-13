import { describe, expect, it } from 'vitest';
import { analyseEfficiency } from '@/lib/analysis/rules/efficiency';

const ids = (code: string) => analyseEfficiency('src/a.ts', code).findings.map((f) => f.ruleId);

describe('nested loops', () => {
  it('flags two nested loops as quadratic', () => {
    const report = analyseEfficiency(
      'src/a.ts',
      `function pairs(a, b) {
         for (const x of a) {
           for (const y of b) {
             console.log(x, y);
           }
         }
       }`,
    );
    expect(report.findings.map((f) => f.ruleId)).toContain('efficiency/nested-loops');
    expect(report.estimatedComplexity).toBe('O(n²)');
    expect(report.grade).not.toBe('A');
  });

  it('treats forEach and map as iteration too', () => {
    expect(ids(`function f(a, b) { a.forEach(x => b.map(y => x + y)); }`)).toContain(
      'efficiency/nested-loops',
    );
  });

  it('does not flag a single loop', () => {
    expect(ids(`function f(a) { for (const x of a) { console.log(x); } }`)).toEqual([]);
  });

  it('does not flag two loops that are siblings rather than nested', () => {
    expect(
      ids(`function f(a, b) {
             for (const x of a) { console.log(x); }
             for (const y of b) { console.log(y); }
           }`),
    ).toEqual([]);
  });
});

describe('linear search inside a loop', () => {
  it('flags .includes() called in a loop', () => {
    const report = analyseEfficiency(
      'src/a.ts',
      `function overlap(a, b) {
         const out = [];
         for (const x of a) { if (b.includes(x)) out.push(x); }
         return out;
       }`,
    );
    const finding = report.findings.find((f) => f.ruleId === 'efficiency/linear-search-in-loop');
    expect(finding?.severity).toBe('HIGH');
    expect(finding?.remediation).toContain('Set');
  });

  it('flags .indexOf() and .find() the same way', () => {
    expect(ids(`function f(a, b) { for (const x of a) { b.indexOf(x); } }`)).toContain(
      'efficiency/linear-search-in-loop',
    );
    expect(ids(`function f(a, b) { for (const x of a) { b.find(y => y === x); } }`)).toContain(
      'efficiency/linear-search-in-loop',
    );
  });

  it('does not flag a linear scan outside a loop', () => {
    expect(ids(`function f(a, x) { return a.includes(x); }`)).toEqual([]);
  });
});

describe('sequential awaits', () => {
  it('flags await inside a loop', () => {
    const finding = analyseEfficiency(
      'src/a.ts',
      `async function load(ids) {
         const out = [];
         for (const id of ids) { out.push(await fetch(id)); }
         return out;
       }`,
    ).findings.find((f) => f.ruleId === 'efficiency/await-in-loop');

    expect(finding?.severity).toBe('HIGH');
    expect(finding?.remediation).toContain('Promise.all');
  });

  it('does not flag a single await outside a loop', () => {
    expect(ids(`async function f(id) { return await fetch(id); }`)).toEqual([]);
  });
});

describe('accumulation by copying', () => {
  it('flags array spread accumulation', () => {
    expect(
      ids(`function f(items) {
             let out = [];
             for (const i of items) { out = [...out, i]; }
             return out;
           }`),
    ).toContain('efficiency/spread-accumulation');
  });

  it('flags object spread accumulation', () => {
    expect(
      ids(`function f(items) {
             let acc = {};
             for (const i of items) { acc = { ...acc, [i]: true }; }
             return acc;
           }`),
    ).toContain('efficiency/spread-accumulation');
  });

  it('does not flag push, which is the correct pattern', () => {
    expect(
      ids(`function f(items) {
             const out = [];
             for (const i of items) { out.push(i); }
             return out;
           }`),
    ).toEqual([]);
  });
});

describe('other patterns', () => {
  it('flags a JSON round-trip deep clone', () => {
    expect(ids(`const copy = JSON.parse(JSON.stringify(original));`)).toContain(
      'efficiency/json-deep-clone',
    );
  });

  it('flags sorting inside a loop', () => {
    expect(ids(`function f(a) { for (const x of a) { a.sort(); } }`)).toContain(
      'efficiency/sort-in-loop',
    );
  });

  it('flags a RegExp constructed inside a loop', () => {
    expect(ids(`function f(a) { for (const x of a) { new RegExp(x); } }`)).toContain(
      'efficiency/regex-in-loop',
    );
  });

  it('flags shift() inside a loop', () => {
    expect(ids(`function f(q) { while (q.length) { q.shift(); } }`)).toContain(
      'efficiency/array-reindex-in-loop',
    );
  });
});

describe('scoring', () => {
  it('gives clean code an A with a perfect score', () => {
    const report = analyseEfficiency(
      'src/a.ts',
      `export function sum(items: number[]) {
         let total = 0;
         for (const item of items) total += item;
         return total;
       }`,
    );
    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.estimatedComplexity).toBe('no super-linear pattern detected');
  });

  it('drops the grade as problems accumulate', () => {
    const bad = analyseEfficiency(
      'src/a.ts',
      `async function f(a, b) {
         let out = [];
         for (const x of a) {
           for (const y of b) {
             if (b.includes(y)) out = [...out, await fetch(y)];
           }
         }
         return out;
       }`,
    );
    expect(bad.score).toBeLessThan(40);
    expect(bad.grade).toBe('F');
  });

  it('skips test files', () => {
    const report = analyseEfficiency(
      'src/a.test.ts',
      `for (const x of a) { for (const y of b) {} }`,
    );
    expect(report.parsed).toBe(false);
    expect(report.findings).toEqual([]);
  });

  it('reports a line number for every finding', () => {
    const report = analyseEfficiency(
      'src/a.ts',
      `function f(a, b) {\n  for (const x of a) {\n    b.includes(x);\n  }\n}`,
    );
    for (const finding of report.findings) {
      expect(finding.line).toBeGreaterThan(0);
      expect(finding.file).toBe('src/a.ts');
    }
  });
});

describe('false-positive control on linear scans', () => {
  const idsOf = (code: string) => analyseEfficiency('src/a.ts', code).findings.map((f) => f.ruleId);

  /**
   * `path.indexOf('/')` is a fixed-substring search on a short string, not the
   * quadratic collection lookup this rule is for. Reporting it is the kind of
   * noise that gets a whole analyser switched off.
   */
  it('ignores a literal search argument', () => {
    expect(idsOf(`function f(parts) { for (const p of parts) { p.indexOf('/'); } }`)).not.toContain(
      'efficiency/linear-search-in-loop',
    );
  });

  it('ignores a receiver that is plainly a string', () => {
    expect(
      idsOf(`function f(items, path) { for (const x of items) { path.includes(x); } }`),
    ).not.toContain('efficiency/linear-search-in-loop');
  });

  it('still flags a collection searched by a variable', () => {
    expect(
      idsOf(`function f(items, known) { for (const x of items) { known.includes(x); } }`),
    ).toContain('efficiency/linear-search-in-loop');
  });

  it('still flags a predicate callback', () => {
    expect(
      idsOf(`function f(items, rows) { for (const x of items) { rows.find(r => r.id === x); } }`),
    ).toContain('efficiency/linear-search-in-loop');
  });
});

describe('extractBigO', () => {
  it('pulls the notation out of surrounding prose', async () => {
    const { extractBigO } = await import('@/lib/text');
    expect(extractBigO('O(n^2)\n  Where the inner loop is searching, build a Set')).toBe('O(n^2)');
    expect(extractBigO('roughly O(n log n) overall')).toBe('O(nlogn)');
    expect(extractBigO('O(1)')).toBe('O(1)');
  });

  it('returns empty when there is no notation to find', async () => {
    const { extractBigO } = await import('@/lib/text');
    expect(extractBigO('the complexity did not change meaningfully')).toBe('');
    expect(extractBigO('')).toBe('');
  });
});

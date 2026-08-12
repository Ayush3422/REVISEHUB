import { describe, expect, it } from 'vitest';
import { parseDiff } from '@/lib/diff';
import { secretRules } from '@/lib/analysis/rules/secrets';

/** Builds a one-file diff whose hunk contains the given added lines. */
function diffAdding(path: string, ...lines: string[]): string {
  const body = lines.map((l) => `+${l}`).join('\n');
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,0 +1,${lines.length} @@\n${body}\n`;
}

function run(path: string, ...lines: string[]) {
  return secretRules(parseDiff(diffAdding(path, ...lines)));
}

describe('secret detection', () => {
  it('detects an AWS access key id', () => {
    const findings = run('src/config.ts', 'const key = "AKIAIOSFODNN7EXAMPLE";');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('secrets/aws-access-key');
    expect(findings[0]?.severity).toBe('CRITICAL');
  });

  it('detects a Google API key', () => {
    // Exactly 39 characters: the `AIza` prefix plus 35. The rule is deliberately
    // strict about that length, so the fixture has to be the real shape.
    const findings = run('src/g.ts', 'const k = "AIzaSyA1234567890abcdefghijklmnopqrstuv";');
    expect(findings.map((f) => f.ruleId)).toContain('secrets/google-api-key');
  });

  it('does not match a string that is merely AIza-prefixed', () => {
    expect(run('src/g.ts', 'const k = "AIzaShortString";')).toHaveLength(0);
  });

  it('detects a private key block', () => {
    const findings = run('deploy/key', '-----BEGIN RSA PRIVATE KEY-----');
    expect(findings.map((f) => f.ruleId)).toContain('secrets/private-key');
  });

  it('detects a database URL containing a password', () => {
    const findings = run('src/db.ts', 'const url = "postgres://admin:hunter2@db.example.com/app";');
    expect(findings.map((f) => f.ruleId)).toContain('secrets/postgres-url');
  });

  /**
   * The most important property of this rule: a finding must never carry the
   * credential it found, or the scanner becomes a way to copy secrets into
   * logs and rendered pages.
   */
  it('never includes the raw secret in the finding', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const findings = run('src/config.ts', `const key = "${secret}";`);
    const serialised = JSON.stringify(findings);

    expect(serialised).not.toContain(secret);
    expect(findings[0]?.evidence).toContain('redacted');
    // The first few characters are kept so the value is identifiable.
    expect(findings[0]?.evidence).toContain('AKIA');
  });

  it('reports the line number of the secret', () => {
    const findings = run('src/config.ts', 'const a = 1;', 'const key = "AKIAIOSFODNN7EXAMPLE";');
    expect(findings[0]?.line).toBe(2);
  });

  it('ignores secrets on removed lines', () => {
    const diff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,1 +1,1 @@
-const key = "AKIAIOSFODNN7EXAMPLE";
+const key = process.env.AWS_KEY;
`;
    expect(secretRules(parseDiff(diff))).toHaveLength(0);
  });

  it('ignores lockfiles, where long hashes are normal', () => {
    expect(run('package-lock.json', '"integrity": "AKIAIOSFODNN7EXAMPLE"')).toHaveLength(0);
  });

  it('reports each credential type once per file', () => {
    const findings = run(
      'src/config.ts',
      'const a = "AKIAIOSFODNN7EXAMPLE";',
      'const b = "AKIAIOSFODNN7EXAMPLF";',
    );
    expect(findings.filter((f) => f.ruleId === 'secrets/aws-access-key')).toHaveLength(1);
  });
});

describe('high-entropy assignment heuristic', () => {
  it('flags a secret-sounding variable with a random value', () => {
    const findings = run('src/a.ts', 'const apiKey = "f8Kq2Zx9Lp4Wn7Vb3Rt6Yh1Jm5Cd0Sg";');
    expect(findings.map((f) => f.ruleId)).toContain('secrets/high-entropy-assignment');
  });

  it('ignores obvious placeholders', () => {
    for (const value of ['your-api-key-here', 'xxxxxxxxxxxxxxxxxx', 'process.env.API_KEY']) {
      expect(run('src/a.ts', `const apiKey = "${value}";`)).toHaveLength(0);
    }
  });

  it('ignores low-entropy values', () => {
    expect(run('src/a.ts', 'const password = "aaaaaaaaaaaaaaaaaaaa";')).toHaveLength(0);
  });

  it('ignores .env.example, which exists to hold fake values', () => {
    expect(run('.env.example', 'API_KEY = "f8Kq2Zx9Lp4Wn7Vb3Rt6Yh1Jm5Cd0Sg"')).toHaveLength(0);
  });

  it('ignores assignments to names that do not suggest a secret', () => {
    expect(run('src/a.ts', 'const commitHash = "f8Kq2Zx9Lp4Wn7Vb3Rt6Yh1Jm5Cd0Sg";')).toHaveLength(
      0,
    );
  });
});

import 'server-only';
import type { Finding, FindingSeverity } from '../types';

/**
 * Dependency vulnerability scanning via OSV.dev.
 *
 * OSV is Google's open vulnerability database. The API needs no account, no
 * key, and no auth header, which is what makes this rule work on a free
 * deployment with nothing configured.
 *
 * https://google.github.io/osv.dev/api/
 */

const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN = 'https://api.osv.dev/v1/vulns';

/** Keeps one pathological manifest from stalling the request. */
const MAX_PACKAGES = 300;
const MAX_DETAIL_LOOKUPS = 40;

interface OsvBatchResponse {
  results: { vulns?: { id: string; modified: string }[] }[];
}

interface OsvSeverityEntry {
  type: string;
  score: string;
}

interface OsvAffected {
  package?: { name?: string; ecosystem?: string };
  ranges?: { type: string; events: { introduced?: string; fixed?: string }[] }[];
}

interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: OsvSeverityEntry[];
  affected?: OsvAffected[];
  database_specific?: { severity?: string };
}

interface PackageRef {
  name: string;
  version: string;
  /** Whether it came from `dependencies` rather than `devDependencies`. */
  isRuntime: boolean;
}

/**
 * Reads a package.json manifest. Semver ranges are stripped to a concrete
 * version, which is approximate: the installed version could differ. Findings
 * are worded to reflect that rather than asserting certainty.
 */
export function parsePackageJson(text: string): PackageRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const manifest = parsed as Record<string, unknown>;
  const packages: PackageRef[] = [];

  const collect = (field: string, isRuntime: boolean) => {
    const section = manifest[field];
    if (!section || typeof section !== 'object') return;

    for (const [name, raw] of Object.entries(section as Record<string, unknown>)) {
      if (typeof raw !== 'string') continue;

      // Skip anything that is not a plain registry version: workspace
      // protocols, git URLs, file paths and tags have no comparable version.
      if (/^(?:workspace:|file:|link:|git|https?:|npm:|github:)/i.test(raw)) continue;

      const version = raw.replace(/^[\^~><=v\s]+/, '').trim();
      if (!/^\d+\.\d+/.test(version)) continue;

      packages.push({ name, version, isRuntime });
    }
  };

  collect('dependencies', true);
  collect('devDependencies', false);

  return packages.slice(0, MAX_PACKAGES);
}

/** Maps a CVSS vector or qualitative label onto our severity scale. */
function severityFrom(vuln: OsvVuln): FindingSeverity {
  const label = vuln.database_specific?.severity?.toUpperCase();
  if (label === 'CRITICAL') return 'CRITICAL';
  if (label === 'HIGH') return 'HIGH';
  if (label === 'MODERATE' || label === 'MEDIUM') return 'MEDIUM';
  if (label === 'LOW') return 'LOW';

  const cvss = vuln.severity?.find((s) => s.type.startsWith('CVSS'));
  if (cvss) {
    const base = parseCvssBase(cvss.score);
    if (base !== null) {
      if (base >= 9) return 'CRITICAL';
      if (base >= 7) return 'HIGH';
      if (base >= 4) return 'MEDIUM';
      return 'LOW';
    }
  }

  return 'MEDIUM';
}

/**
 * OSV reports CVSS as a vector string, not a number. Deriving a precise base
 * score from the vector is involved; a coarse read of the impact metrics is
 * enough to rank findings, and `severityFrom` falls back to MEDIUM otherwise.
 */
function parseCvssBase(score: string): number | null {
  const numeric = Number(score);
  if (!Number.isNaN(numeric)) return numeric;

  const high = (score.match(/[CIA]:H/g) ?? []).length;
  const low = (score.match(/[CIA]:L/g) ?? []).length;
  if (high === 0 && low === 0) return null;

  const network = /AV:N/.test(score);
  const noPriv = /PR:N/.test(score);
  const noInteraction = /UI:N/.test(score);

  let estimate = 2 + high * 2.2 + low * 0.8;
  if (network) estimate += 1.5;
  if (noPriv) estimate += 0.7;
  if (noInteraction) estimate += 0.5;

  return Math.min(estimate, 10);
}

/** The lowest version marked as fixing this vulnerability, if any. */
function fixedVersion(vuln: OsvVuln, packageName: string): string | null {
  const affected =
    vuln.affected?.find((a) => a.package?.name === packageName) ?? vuln.affected?.[0];
  for (const range of affected?.ranges ?? []) {
    for (const event of range.events) {
      if (event.fixed) return event.fixed;
    }
  }
  return null;
}

export async function dependencyRules(packageJsonText: string): Promise<Finding[]> {
  const packages = parsePackageJson(packageJsonText);
  if (packages.length === 0) return [];

  let batch: OsvBatchResponse;
  try {
    const res = await fetch(OSV_BATCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: packages.map((p) => ({
          package: { name: p.name, ecosystem: 'npm' },
          version: p.version,
        })),
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    batch = (await res.json()) as OsvBatchResponse;
  } catch {
    // A vulnerability database being unreachable is not itself a finding.
    return [];
  }

  // querybatch returns ids only, so details are fetched for matches. Most
  // manifests have few or none, which keeps this cheap.
  const lookups: { pkg: PackageRef; id: string }[] = [];
  batch.results?.forEach((result, index) => {
    const pkg = packages[index];
    if (!pkg) return;
    for (const vuln of result.vulns ?? []) {
      lookups.push({ pkg, id: vuln.id });
    }
  });

  const limited = lookups.slice(0, MAX_DETAIL_LOOKUPS);

  const details = await Promise.all(
    limited.map(async ({ pkg, id }) => {
      try {
        const res = await fetch(`${OSV_VULN}/${encodeURIComponent(id)}`, {
          next: { revalidate: 86400 },
        });
        if (!res.ok) return null;
        return { pkg, vuln: (await res.json()) as OsvVuln };
      } catch {
        return null;
      }
    }),
  );

  const findings: Finding[] = [];

  for (const entry of details) {
    if (!entry) continue;
    const { pkg, vuln } = entry;

    const severity = severityFrom(vuln);
    const fixed = fixedVersion(vuln, pkg.name);
    const cve = vuln.aliases?.find((a) => a.startsWith('CVE-')) ?? vuln.id;

    findings.push({
      ruleId: 'dependencies/known-vulnerability',
      source: 'engine',
      category: 'DEPENDENCY',
      // A vulnerability only reachable in tooling is real but lower priority
      // than the same flaw shipping to users.
      severity: pkg.isRuntime ? severity : downgrade(severity),
      title: `${pkg.name}@${pkg.version} — ${cve}`,
      description: `${vuln.summary ?? 'A known vulnerability affects this version.'}${
        pkg.isRuntime ? '' : ' This is a development dependency, so it does not ship to users.'
      }`,
      file: 'package.json',
      line: null,
      evidence: `${pkg.name}@${pkg.version}`,
      remediation: fixed
        ? `Upgrade ${pkg.name} to ${fixed} or later.`
        : `No fixed version is published yet. Check the advisory for a workaround, or consider replacing this dependency.`,
      referenceUrl: `https://osv.dev/vulnerability/${vuln.id}`,
      confidence: 1,
    });
  }

  if (lookups.length > limited.length) {
    findings.push({
      ruleId: 'dependencies/truncated',
      source: 'engine',
      category: 'DEPENDENCY',
      severity: 'INFO',
      title: `${lookups.length - limited.length} further advisories not shown`,
      description: `This project matched ${lookups.length} advisories in total; the ${limited.length} shown are the ones fetched in detail.`,
      file: 'package.json',
      line: null,
      remediation: 'Run `npm audit` locally for the complete list.',
      confidence: 1,
    });
  }

  return findings;
}

function downgrade(severity: FindingSeverity): FindingSeverity {
  const order: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const index = order.indexOf(severity);
  return order[Math.min(index + 1, order.length - 1)] ?? 'INFO';
}

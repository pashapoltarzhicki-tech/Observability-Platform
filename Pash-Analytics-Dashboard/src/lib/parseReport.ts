import { PlaywrightReport, PlaywrightSuite, PlaywrightSpec } from '../types/playwright';
import { FlatSpec, ParsedRun } from '../types/app';

function flattenSpecs(suites: PlaywrightSuite[], suitePath: string[] = []): FlatSpec[] {
  const result: FlatSpec[] = [];

  for (const suite of suites) {
    const currentPath = suite.title ? [...suitePath, suite.title] : suitePath;

    if (suite.specs) {
      for (const spec of suite.specs) {
        result.push(normalizeFlatSpec(spec, currentPath));
      }
    }

    if (suite.suites) {
      result.push(...flattenSpecs(suite.suites, currentPath));
    }
  }

  return result;
}

function normalizeFlatSpec(spec: PlaywrightSpec, suitePath: string[]): FlatSpec {
  const fullTitle = [...suitePath, spec.title].filter(Boolean).join(' > ');
  return {
    id: spec.id,
    title: spec.title,
    fullTitle,
    file: spec.file,
    line: spec.line,
    column: spec.column,
    tags: spec.tags ?? [],
    ok: spec.ok,
    tests: spec.tests ?? [],
    suitePath,
  };
}

export function generateRunId(filename: string, startTime: string): string {
  const raw = filename + startTime;
  // Simple base64-like stable hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
}

export function parseReport(json: PlaywrightReport, filename: string, branch = 'main', commit = ''): ParsedRun {
  const specs = flattenSpecs(json.suites ?? []);
  const projects = Array.from(
    new Set(specs.flatMap((s) => s.tests.map((t) => t.projectName)).filter(Boolean))
  );

  const startTime = json.stats?.startTime ?? new Date().toISOString();
  const id = generateRunId(filename, startTime);

  // Use metadata injected by Argo if available
  const meta = (json as any)._meta;
  const appVersion = meta?.appVersion || '';
  const versionMatch = appVersion.match(/^(.+)-([a-f0-9]{7,})$/);
  const resolvedBranch = meta?.branch || (versionMatch ? versionMatch[1] : branch);
  const resolvedCommit = meta?.commit || (versionMatch ? versionMatch[2] : commit);

  return {
    id,
    filename,
    branch: resolvedBranch,
    commit: resolvedCommit,
    env: meta?.env || '',
    tag: meta?.tag || '',
    baseurl: meta?.baseurl || '',
    testResultsGCSPath: meta?.testResultsGCSPath || '',
    appVersion,
    testVersion: meta?.testVersion || '',
    startTime: new Date(startTime),
    duration: json.stats?.duration ?? 0,
    stats: json.stats ?? {
      startTime: new Date().toISOString(),
      duration: 0,
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    },
    config: json.config ?? {},
    specs,
    projects,
  };
}

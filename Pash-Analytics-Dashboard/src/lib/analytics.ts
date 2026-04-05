import { ParsedRun, FlatSpec, FlakyTest, SlowTest, Failure, RunSummary, OverallStats, SpecFileSummary, TagStat } from '../types/app';

export function detectFlakyTests(runs: ParsedRun[]): FlakyTest[] {
  const testMap = new Map<string, { spec: FlatSpec; runStatuses: Array<{ runId: string; filename: string; status: string }> }>();

  for (const run of runs) {
    for (const spec of run.specs) {
      const key = spec.fullTitle + '||' + spec.file;

      if (!testMap.has(key)) {
        testMap.set(key, { spec, runStatuses: [] });
      }

      const entry = testMap.get(key)!;

      for (const test of spec.tests) {
        entry.runStatuses.push({ runId: run.id, filename: run.filename, status: test.status });
      }
    }
  }

  const flaky: FlakyTest[] = [];

  for (const [, { spec, runStatuses }] of testMap) {
    const flakyCount = runStatuses.filter((r) => r.status === 'flaky').length;
    const failedCount = runStatuses.filter((r) => r.status === 'unexpected').length;
    const total = runStatuses.length;
    const hasRetries = spec.tests.some((t) => t.results.some((r) => r.retry > 0));

    if (flakyCount > 0 || hasRetries || (runs.length > 1 && failedCount > 0 && failedCount < total)) {
      const lastStatus = runStatuses[runStatuses.length - 1]?.status ?? 'unknown';
      flaky.push({
        id: spec.id,
        title: spec.title,
        fullTitle: spec.fullTitle,
        file: spec.file,
        occurrences: total,
        flakyCount,
        failedCount,
        flakinessRate: Math.round(((flakyCount + failedCount) / total) * 100),
        tags: spec.tags,
        runs: runStatuses,
        lastStatus,
      });
    }
  }

  return flaky.sort((a, b) => b.flakinessRate - a.flakinessRate);
}

export function getSlowTests(runs: ParsedRun[]): SlowTest[] {
  const testMap = new Map<string, { spec: FlatSpec; durations: number[] }>();

  for (const run of runs) {
    for (const spec of run.specs) {
      const key = spec.fullTitle + '||' + spec.file;

      if (!testMap.has(key)) {
        testMap.set(key, { spec, durations: [] });
      }

      const entry = testMap.get(key)!;

      for (const test of spec.tests) {
        for (const result of test.results) {
          if (result.duration > 0) {
            entry.durations.push(result.duration);
          }
        }
      }
    }
  }

  const slow: SlowTest[] = [];

  for (const [, { spec, durations }] of testMap) {
    if (durations.length === 0) continue;
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);

    slow.push({
      id: spec.id,
      title: spec.title,
      fullTitle: spec.fullTitle,
      file: spec.file,
      avgDuration: Math.round(avg),
      maxDuration: max,
      occurrences: durations.length,
    });
  }

  return slow.sort((a, b) => b.avgDuration - a.avgDuration).slice(0, 10);
}

export function getFailures(runs: ParsedRun[]): Failure[] {
  const failures: Failure[] = [];

  for (const run of runs) {
    for (const spec of run.specs) {
      for (const test of spec.tests) {
        if (test.status !== 'unexpected' && test.status !== 'flaky') continue;

        for (const result of test.results) {
          if (result.status !== 'failed' && result.status !== 'timedOut') continue;

          const err = result.errors?.[0];
          failures.push({
            id: `${spec.id}-${run.id}-${result.retry}`,
            title: spec.title,
            fullTitle: spec.fullTitle,
            file: spec.file,
            suitePath: spec.suitePath,
            errorMessage: err?.message ?? err?.stack ?? 'Unknown error',
            errorLocation: err?.location,
            retryCount: result.retry,
            runId: run.id,
            filename: run.filename,
            projectName: test.projectName,
            duration: result.duration,
          });
        }
      }
    }
  }

  return failures;
}

export function getRunsSummary(runs: ParsedRun[]): RunSummary[] {
  return runs
    .map((run) => {
      const stats = run.stats;
      const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0) + (stats.skipped ?? 0);
      const passed = stats.expected ?? 0;
      const failed = stats.unexpected ?? 0;
      const flaky = stats.flaky ?? 0;
      const skipped = stats.skipped ?? 0;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

      return {
        id: run.id,
        filename: run.filename,
        branch: run.branch,
        commit: run.commit,
        env: run.env,
        startTime: run.startTime,
        duration: run.duration,
        total,
        passed,
        failed,
        flaky,
        skipped,
        passRate,
        source: run.source ?? 'gcs',
      };
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function getOverallStats(runs: ParsedRun[]): OverallStats {
  if (runs.length === 0) {
    return { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, duration: 0, avgDuration: 0, passRate: 0 };
  }

  let total = 0;
  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let skipped = 0;
  let totalDuration = 0;
  let testCount = 0;

  for (const run of runs) {
    total += (run.stats.expected ?? 0) + (run.stats.unexpected ?? 0) + (run.stats.flaky ?? 0) + (run.stats.skipped ?? 0);
    passed += run.stats.expected ?? 0;
    failed += run.stats.unexpected ?? 0;
    flaky += run.stats.flaky ?? 0;
    skipped += run.stats.skipped ?? 0;

    for (const spec of run.specs) {
      for (const test of spec.tests) {
        for (const result of test.results) {
          if (result.duration > 0) {
            totalDuration += result.duration;
            testCount++;
          }
        }
      }
    }
  }

  const avgDuration = testCount > 0 ? Math.round(totalDuration / testCount) : 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const duration = runs.reduce((sum, r) => sum + r.duration, 0);

  return { total, passed, failed, flaky, skipped, duration, avgDuration, passRate };
}

export function getSpecFileSummaries(run: ParsedRun): SpecFileSummary[] {
  const fileMap = new Map<string, SpecFileSummary>();

  for (const spec of run.specs) {
    if (!fileMap.has(spec.file)) {
      fileMap.set(spec.file, {
        file: spec.file,
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        status: 'passed',
        specs: [],
      });
    }

    const entry = fileMap.get(spec.file)!;
    entry.specs.push(spec);

    for (const test of spec.tests) {
      entry.tests++;
      if (test.status === 'expected') entry.passed++;
      else if (test.status === 'unexpected') entry.failed++;
      else if (test.status === 'skipped') entry.skipped++;
      else if (test.status === 'flaky') { entry.passed++; }

      for (const result of test.results) {
        entry.duration += result.duration;
      }
    }
  }

  // Compute status
  for (const entry of fileMap.values()) {
    if (entry.failed > 0 && entry.passed === 0) entry.status = 'failed';
    else if (entry.failed > 0) entry.status = 'partial';
    else if (entry.skipped === entry.tests) entry.status = 'skipped';
    else entry.status = 'passed';
  }

  return Array.from(fileMap.values()).sort((a, b) => a.file.localeCompare(b.file));
}

export function getTagStats(runs: ParsedRun[]): TagStat[] {
  const tagMap = new Map<string, number>();

  for (const run of runs) {
    for (const spec of run.specs) {
      for (const tag of spec.tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function getMostFailingTests(runs: ParsedRun[]) {
  const testMap = new Map<string, { title: string; file: string; total: number; failed: number }>();

  for (const run of runs) {
    for (const spec of run.specs) {
      const key = spec.fullTitle + '||' + spec.file;
      if (!testMap.has(key)) {
        testMap.set(key, { title: spec.title, file: spec.file, total: 0, failed: 0 });
      }
      const entry = testMap.get(key)!;
      for (const test of spec.tests) {
        entry.total++;
        if (test.status === 'unexpected') entry.failed++;
      }
    }
  }

  return Array.from(testMap.values())
    .filter((t) => t.failed > 0)
    .map((t) => ({ ...t, failureRate: Math.round((t.failed / t.total) * 100) }))
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 10);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

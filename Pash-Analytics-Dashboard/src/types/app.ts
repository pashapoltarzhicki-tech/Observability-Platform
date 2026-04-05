// Internal app types

import { PlaywrightStats, PlaywrightConfig, PlaywrightTest } from './playwright';

export interface FlatSpec {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  line: number;
  column: number;
  tags: string[];
  ok: boolean;
  tests: PlaywrightTest[];
  suitePath: string[];
}

export interface ParsedRun {
  id: string;
  filename: string;
  branch: string;
  commit: string;
  env: string;
  tag: string;
  baseurl: string;
  testResultsGCSPath: string;
  appVersion: string;
  testVersion: string;
  startTime: Date;
  duration: number;
  stats: PlaywrightStats;
  config: PlaywrightConfig;
  specs: FlatSpec[];
  projects: string[];
  source: 'gcs' | 'upload';
}

export interface FlakyTest {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  occurrences: number;
  flakyCount: number;
  failedCount: number;
  flakinessRate: number;
  tags: string[];
  runs: Array<{ runId: string; filename: string; status: string }>;
  lastStatus: string;
}

export interface SlowTest {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  avgDuration: number;
  maxDuration: number;
  occurrences: number;
}

export interface Failure {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  suitePath: string[];
  errorMessage: string;
  errorLocation?: { file: string; line: number; column: number };
  retryCount: number;
  runId: string;
  filename: string;
  projectName: string;
  duration: number;
}

export interface RunSummary {
  id: string;
  filename: string;
  branch: string;
  commit: string;
  env: string;
  startTime: Date;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  passRate: number;
  source: 'gcs' | 'upload';
}

export interface OverallStats {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  duration: number;
  avgDuration: number;
  passRate: number;
}

export interface SpecFileSummary {
  file: string;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  status: 'passed' | 'failed' | 'skipped' | 'partial';
  specs: FlatSpec[];
}

export interface TagStat {
  tag: string;
  count: number;
}

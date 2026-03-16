// Raw Playwright JSON report types

export interface PlaywrightConfig {
  version?: string;
  workers?: number;
  projects?: PlaywrightProject[];
  configFile?: string;
  rootDir?: string;
}

export interface PlaywrightProject {
  id: string;
  name: string;
  retries: number;
  testDir?: string;
  timeout?: number;
}

export interface PlaywrightAttachment {
  name: string;
  contentType: string;
  path?: string;
  body?: string;
}

export interface PlaywrightResult {
  workerIndex: number;
  parallelIndex?: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  errors: Array<{ message?: string; stack?: string; location?: { file: string; line: number; column: number } }>;
  stdout: Array<{ text?: string; buffer?: string; timestamp?: number }>;
  stderr: Array<{ text?: string; buffer?: string; timestamp?: number }>;
  retry: number;
  startTime: string;
  attachments: PlaywrightAttachment[];
}

export interface PlaywrightTest {
  timeout: number;
  annotations: Array<{ type: string; description?: string }>;
  expectedStatus: string;
  projectId: string;
  projectName: string;
  results: PlaywrightResult[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}

export interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tags: string[];
  tests: PlaywrightTest[];
  id: string;
  file: string;
  line: number;
  column: number;
}

export interface PlaywrightSuite {
  title: string;
  file?: string;
  line?: number;
  column?: number;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

export interface PlaywrightStats {
  startTime: string;
  duration: number;
  expected: number;
  skipped: number;
  unexpected: number;
  flaky: number;
}

export interface PlaywrightReport {
  config: PlaywrightConfig;
  suites: PlaywrightSuite[];
  errors: Array<{ message?: string; stack?: string }>;
  stats: PlaywrightStats;
}
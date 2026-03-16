# Playwright Test Analytics Dashboard — Project Spec

A lightweight alternative to Currents/TestDino focused on Playwright test analytics, built as a zero-backend SPA that reads JSON reports directly from Google Cloud Storage.

---

## System Architecture

```
Argo Workflow
    └── Playwright tests run
        └── JSON report uploaded to GCS
                └── Dashboard reads GCS via Express proxy
                    └── Browser caches in IndexedDB
                        └── Client-side analytics rendered in React
```

**Stack:**
- **Frontend**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS v3 (`darkMode: 'class'`)
- **Charts**: Recharts
- **Routing**: react-router-dom v6
- **Icons**: lucide-react
- **Dates**: date-fns
- **GCS proxy**: Express.js (CommonJS) on port 3001 (`server/index.cjs`)
- **Cache**: IndexedDB via `src/lib/idbCache.ts`

**Dev command:** `npm run dev` — runs Vite + Express concurrently via `concurrently`

**Vite proxy:** `/api/gcs` → `http://localhost:3001`

---

## GCS Storage Model

**Bucket:** `argo-test-result-20251027`
**Prefix:** `reports/`

**Path structure:**
```
reports/
  YYYY/
    MM/
      DD/
        {job-name-timestamp}/
          results.json
```

**Example:**
```
reports/2026/03/11/snapshot-binder-cron-1768151100/results.json
```

**Server API endpoints** (`server/index.cjs`):
- `GET /api/gcs/scan?from=YYYY-MM-DD` — list all JSON files newer than date
- `GET /api/gcs/today` — list only today's files
- `GET /api/gcs/file?path=...` — download single file content
- Auth: Application Default Credentials (`@google-cloud/storage`)

---

## Playwright JSON Report Schema

Each `results.json` is a standard Playwright JSON reporter output:

```typescript
interface PlaywrightReport {
  stats: {
    startTime: string;   // ISO timestamp
    duration: number;    // ms
    expected: number;    // passed
    unexpected: number;  // failed
    flaky: number;
    skipped: number;
  };
  suites: Suite[];       // top-level suites (usually one per spec file)
}

interface Suite {
  title: string;
  file: string;
  suites: Suite[];       // nested suites
  specs: Spec[];
}

interface Spec {
  title: string;
  ok: boolean;
  tags: string[];
  tests: Test[];
  id: string;
  file: string;
}

interface Test {
  timeout: number;
  annotations: Annotation[];
  expectedStatus: string;
  projectName: string;   // e.g. "chromium" — comes from playwright.config.ts
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: TestResult[];
}

interface TestResult {
  workerIndex: number;
  status: string;
  duration: number;
  error?: { message: string; stack?: string };
  attachments: Attachment[];
  startTime: string;
  retry: number;
}
```

> **Note:** `projectName` (e.g. "chromium") comes from `playwright.config.ts` project definitions, not the dashboard.

**Parsed into `ParsedRun`** (`src/types/app.ts`):
- `id`: derived from filename + timestamp
- `branch`: from upload metadata or GCS path
- `commit`: from upload metadata
- `stats`, `specs` (flattened from all suites)

---

## Caching Strategy

**Storage:** IndexedDB — DB: `pw-gcs-cache`, store: `reports`

**Rules:**
| File date | Behavior |
|-----------|----------|
| Past days | Immutable — cached permanently, never re-downloaded |
| Today | Always re-listed from GCS, only download new ones |
| > 3 months | Pruned from cache automatically |

**Load flow (`src/lib/gcsLoader.ts`):**
1. Load all cached entries from IndexedDB → inject into state immediately
2. Scan GCS for new files (one API call lists metadata)
3. Download only files not in cache
4. Cache new files in IndexedDB
5. Prune entries older than 3 months

**Refresh flow:**
- If `gcsStatus.stage === 'error'` → full reload
- Otherwise → `refreshToday()` — only fetches today's new files

---

## Data Flow

```
GCS scan (server proxy)
    → idbCache (IndexedDB)
        → parseReport() → ParsedRun[]
            → ReportsContext (global state)
                ├── runs[]           — all runs
                ├── filteredRuns[]   — date-filtered (dateFrom/dateTo)
                ├── allBranches[]    — derived
                └── allTags[]        — derived from spec tags
```

**Key rule:** Pages must use `filteredRuns` (not `runs`) to respect the date range filter. The tag filter is **page-local** (not global) — only relevant in TestCasesPage and FlakyTestsPage.

---

## Dashboard Pages

### 1. Dashboard (`/`)
- KPI cards: total runs, pass rate, failed tests, flaky tests
- Duration trend chart (Recharts LineChart)
- Pass/fail breakdown over time

### 2. Test Runs (`/test-runs`)
- List of runs grouped by date
- Per-run: status badge, duration, test counts
- Click → Run Detail page

### 3. Run Detail (`/test-runs/:id`)
5 tabs: **Summary | Specs | History | Configuration | Insights**
- Summary: stats, pass/fail donut, duration
- Specs: test hierarchy (suite → spec → test), errors
- History: trend for this run's file across past runs
- Configuration: metadata (branch, commit, project)
- Insights: flakiness, slowest tests

### 4. Test Cases (`/test-cases`)
- Filter order: Search → Test Name → Status → Tags → Files
- Test Name: searchable multi-select dropdown (full names, no truncation)
- Tag filter: multi-select with checkboxes
- Uses `filteredRuns` for date filtering

### 5. Flaky Tests (`/flaky-tests`)
- KPI cards use `allFlakyTests` (unfiltered count)
- Table uses filtered results
- Local search + tag filter

### 6. History (`/history`)
### 7. Analytics (`/analytics`)
### 8. Pull Requests (`/pull-requests`)
### 9. Integrations (`/integrations`)
### 10. Settings (`/settings`)

---

## Layout Architecture

```
AppLayout
  ├── Sidebar (fixed, w-60)
  │     └── GCS sync status card + Upload button
  ├── Header (sticky, h-14, z-20)
  │     ├── Page title
  │     ├── Search trigger (Cmd+K → SearchOverlay)
  │     ├── Environment select
  │     ├── Branch select + commit badge
  │     ├── DateRangePicker (default: 1 month ago → today)
  │     ├── Notification bell
  │     ├── Theme toggle (dark/light)
  │     └── User avatar + dropdown
  └── <main> (flex-1, p-6)
        └── {page content}
```

**SearchOverlay** (`src/components/SearchOverlay.tsx`):
- Triggered by Cmd+K or search button click
- Searches: test runs, spec files, test cases
- Keyboard nav: ↑↓ navigate, Enter open, Esc close
- Text highlighting with `<mark>` for matched portions

---

## Known Pitfalls

- **`overflow-hidden` on flex containers clips absolutely-positioned dropdowns** — do not add `overflow-hidden` to any flex container that has dropdown children (DateRangePicker, user menu, etc.)
- **`filteredRuns` vs `runs`** — always use `filteredRuns` in page components for date filtering to work
- **Tag filter is page-local** — do not move it to the global header
- **`projectName` ("chromium")** — comes from `playwright.config.ts`, not hardcoded in the dashboard
- **GCS proxy must be running** — `npm run dev` starts both Vite and Express; running only `vite` will cause GCS errors
- **Date inputs** — always set `max={today}` to prevent selecting future dates

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const storage = new Storage();
const BUCKET = 'argo-test-result-20251027';
const PREFIX = 'reports/';
const WIZARD_PREFIX = 'wizards/';
const SNAPSHOT_PREFIX = 'snapshot/';

// Extract YYYY/MM/DD from path like "reports/2026/03/11/job-name/results.json"
// or "wizards/2026/04/05/15/job-name/playwright-report/results.json"
function dateFromPath(filePath) {
  const parts = filePath.split('/');
  // parts[0] = prefix, parts[1] = YYYY, parts[2] = MM, parts[3] = DD
  if (parts.length >= 4) return `${parts[1]}-${parts[2]}-${parts[3]}`;
  return null;
}

// For reports/: job is at index 4. For wizards/snapshot/: hour is at 4, job is at 5.
function jobNameFromPath(filePath) {
  const parts = filePath.split('/');
  if (parts[0] === 'wizards' || parts[0] === 'snapshot') return parts[5] ?? '';
  return parts[4] ?? '';
}

// Get date N months ago as YYYY-MM-DD
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/gcs/scan?from=YYYY-MM-DD
 * Returns metadata for all JSON files newer than `from`.
 * Called once on startup — lists all objects in one GCS API call.
 */
app.get('/api/gcs/scan', async (req, res) => {
  try {
    const from = req.query.from || monthsAgo(3);
    const today = todayStr();

    const [files] = await storage.bucket(BUCKET).getFiles({ prefix: PREFIX });
    const allFiles = files;

    const result = allFiles
      .filter(f => !f.name.endsWith('/') && f.name.endsWith('.json'))
      .map(f => {
        const date = dateFromPath(f.name);
        return {
          path: f.name,
          date,
          jobName: jobNameFromPath(f.name),
          fileName: f.name.split('/').pop(),
          size: parseInt(f.metadata.size || '0'),
          updated: f.metadata.updated,
          isToday: date === today,
        };
      })
      .filter(f => f.date && f.date >= from)
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json(result);
  } catch (err) {
    console.error('scan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/gcs/today
 * Lists only today's files — used for incremental refresh during the day.
 */
app.get('/api/gcs/today', async (req, res) => {
  try {
    const today = todayStr();
    const datePath = today.replace(/-/g, '/');
    const reportTodayPrefix = `${PREFIX}${datePath}/`;
    const [files] = await storage.bucket(BUCKET).getFiles({ prefix: reportTodayPrefix });

    const result = files
      .filter(f => !f.name.endsWith('/') && f.name.endsWith('.json'))
      .map(f => ({
        path: f.name,
        date: today,
        jobName: jobNameFromPath(f.name),
        fileName: f.name.split('/').pop(),
        size: parseInt(f.metadata.size || '0'),
        updated: f.metadata.updated,
        isToday: true,
      }));

    res.json(result);
  } catch (err) {
    console.error('today error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function guessContentType(filePath) {
  if (filePath.endsWith('.json'))                              return 'application/json';
  if (filePath.endsWith('.png'))                               return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webm'))                              return 'video/webm';
  if (filePath.endsWith('.mp4'))                               return 'video/mp4';
  if (filePath.endsWith('.zip'))                               return 'application/zip';
  return 'application/octet-stream';
}

/**
 * GET /api/gcs/list?prefix=<gcs-folder-prefix>
 * Lists ALL files (any type) under a given prefix. Used to discover attachments.
 */
app.get('/api/gcs/list', async (req, res) => {
  const prefix = req.query.prefix;
  if (!prefix || prefix.includes('..') || prefix.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid prefix' });
  }
  try {
    const [files] = await storage.bucket(BUCKET).getFiles({ prefix });
    const result = files
      .filter(f => !f.name.endsWith('/'))
      .map(f => ({
        path: f.name,
        size: parseInt(f.metadata.size || '0'),
        contentType: f.metadata.contentType,
      }));
    res.json(result);
  } catch (err) {
    console.error('list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/gcs/summary?path=<gcs-object-path>
 * Downloads a Playwright results.json from GCS, strips stdout/stderr/attachments
 * from every result, and returns the compact JSON.
 * Used by the Compare page to avoid loading multi-MB files into the browser.
 */
// Maximum number of specs to return in a summary response.
// Failing/flaky specs are kept first; passing specs fill remaining slots.
const SUMMARY_MAX_SPECS = 3000;

function stripResults(results) {
  return (results ?? []).map(r => {
    if (!r) return r;
    return {
      workerIndex: r.workerIndex,
      parallelIndex: r.parallelIndex,
      status: r.status,
      duration: r.duration,
      retry: r.retry,
      startTime: r.startTime,
      errors: r.errors ?? [],
      error: r.error,   // legacy singular field
      // intentionally drop: stdout, stderr, attachments
      stdout: [],
      stderr: [],
      attachments: [],
    };
  });
}

function stripSuites(suites) {
  return (suites ?? []).map(suite => {
    if (!suite) return suite;
    return {
      title: suite.title,
      file: suite.file,
      line: suite.line,
      column: suite.column,
      specs: (suite.specs ?? []).map(spec => {
        if (!spec) return spec;
        return {
          title: spec.title,
          ok: spec.ok,
          tags: spec.tags,
          id: spec.id,
          file: spec.file,
          line: spec.line,
          column: spec.column,
          tests: (spec.tests ?? []).map(test => {
            if (!test) return test;
            return {
              timeout: test.timeout,
              annotations: test.annotations,
              expectedStatus: test.expectedStatus,
              projectId: test.projectId,
              projectName: test.projectName,
              status: test.status,
              results: stripResults(test.results),
            };
          }),
        };
      }),
      suites: stripSuites(suite.suites),
    };
  });
}

// Flatten all specs out of a stripped suite tree (for counting + bucketing)
function flattenStrippedSpecs(suites) {
  const out = [];
  for (const suite of (suites ?? [])) {
    if (!suite) continue;
    for (const spec of (suite.specs ?? [])) {
      if (spec) out.push(spec);
    }
    out.push(...flattenStrippedSpecs(suite.suites));
  }
  return out;
}

// Rebuild a minimal suite tree from a flat list of specs (one flat suite per file)
function buildFlatSuites(specs) {
  const byFile = new Map();
  for (const spec of specs) {
    const key = spec.file || '';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(spec);
  }
  return Array.from(byFile.entries()).map(([file, fileSpecs]) => ({
    title: file.split('/').pop() || file,
    file,
    line: 0,
    column: 0,
    specs: fileSpecs,
    suites: [],
  }));
}

app.get('/api/gcs/summary', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    const [content] = await storage.bucket(BUCKET).file(filePath).download();
    const report = JSON.parse(content.toString('utf8'));
    const strippedSuites = stripSuites(report.suites);
    const allSpecs = flattenStrippedSpecs(strippedSuites);
    const totalSpecs = allSpecs.length;

    let suites = strippedSuites;
    let truncatedFrom;
    if (totalSpecs > SUMMARY_MAX_SPECS) {
      // Keep failing/flaky specs first, fill remaining budget with passing
      const failing = allSpecs.filter(s => !s.ok);
      const passing = allSpecs.filter(s => s.ok);
      const kept = [...failing, ...passing].slice(0, SUMMARY_MAX_SPECS);
      suites = buildFlatSuites(kept);
      truncatedFrom = totalSpecs;
      console.log(`summary: truncated ${totalSpecs} → ${kept.length} specs for ${filePath}`);
    }

    const summary = {
      stats: report.stats,
      config: report.config,
      errors: report.errors,
      _meta: report._meta,
      _truncatedFrom: truncatedFrom,
      suites,
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(summary);
  } catch (err) {
    console.error('summary error:', err.message, filePath);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/gcs/file?path=<gcs-object-path>
 * Downloads any file from the bucket with correct Content-Type.
 * Allows reports/ and workflow artifact prefixes (wizards/, snapshot/, etc.)
 */
app.get('/api/gcs/file', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  try {
    const file = storage.bucket(BUCKET).file(filePath);
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || guessContentType(filePath);
    const totalSize = parseInt(metadata.size || '0', 10);

    res.setHeader('Content-Type', contentType);
    // JSON reports must not be cached — runs can be re-executed and overwrite the same path.
    // Static assets (images, videos) are safe to cache long-term.
    const isJson = contentType === 'application/json' || filePath.endsWith('.json');
    res.setHeader('Cache-Control', isJson ? 'no-store' : 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req.headers.range;
    if (rangeHeader && totalSize > 0) {
      // Parse "bytes=start-end"
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkSize);
      res.status(206);

      const stream = file.createReadStream({ start, end });
      stream.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      stream.pipe(res);
    } else {
      if (totalSize > 0) res.setHeader('Content-Length', totalSize);
      const stream = file.createReadStream();
      stream.on('error', (err) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      stream.pipe(res);
    }
  } catch (err) {
    console.error('file error:', err.message, filePath);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/gcs/proxy-url?url=<encoded-url>
 * Proxies an absolute HTTPS URL with range request support (for video seeking).
 */
app.get('/api/gcs/proxy-url', async (req, res) => {
  const url = req.query.url;
  if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  try {
    const headers = {};
    if (req.headers.range) headers['Range'] = req.headers.range;

    const upstream = await fetch(url, { headers });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    else res.setHeader('Accept-Ranges', 'bytes');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    res.status(upstream.status);
    upstream.body.pipe(res);
  } catch (err) {
    console.error('proxy-url error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/gcs/upload
 * Uploads a Playwright JSON report to GCS under the manual upload path.
 * Body: { content: PlaywrightReport, name: string }
 * Path: reports/YYYY/MM/DD/upload-{name}-{YYYY-MM-DD-HH-MM}/results.json
 */
app.post('/api/gcs/upload', async (req, res) => {
  const { content, name } = req.body;
  if (!content || !name) {
    return res.status(400).json({ error: '`content` and `name` are required' });
  }

  const startTime = content?.stats?.startTime;
  if (!startTime) {
    return res.status(400).json({ error: 'Missing stats.startTime in report' });
  }

  const d = new Date(startTime);
  if (isNaN(d.getTime())) {
    return res.status(400).json({ error: 'Invalid stats.startTime in report' });
  }

  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  const hh   = String(d.getUTCHours()).padStart(2, '0');
  const min  = String(d.getUTCMinutes()).padStart(2, '0');

  const safeName   = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
  const datetime   = `${yyyy}-${mm}-${dd}-${hh}-${min}`;
  const folderName = `manually-${safeName}-${datetime}`;
  const gcsPath    = `reports/${yyyy}/${mm}/${dd}/${folderName}/results.json`;

  try {
    const file = storage.bucket(BUCKET).file(gcsPath);
    await file.save(JSON.stringify(content), { contentType: 'application/json' });
    res.json({ path: gcsPath, folderName, date: `${yyyy}-${mm}-${dd}` });
  } catch (err) {
    console.error('upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve built SPA only in production (dist/ does not exist in dev mode)
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../dist');
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Bucket: gs://${BUCKET}/${PREFIX}`);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the old process: lsof -ti :${PORT} | xargs kill -9`);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

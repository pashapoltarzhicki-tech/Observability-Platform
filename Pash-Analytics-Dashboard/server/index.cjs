const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const storage = new Storage();
const BUCKET = 'argo-test-result-20251027';
const PREFIX = 'reports/';

// Extract YYYY/MM/DD from path like "reports/2026/03/11/job-name/results.json"
function dateFromPath(filePath) {
  const parts = filePath.split('/');
  // parts: ['reports', '2026', '03', '11', 'job', 'file.json']
  if (parts.length >= 4) return `${parts[1]}-${parts[2]}-${parts[3]}`;
  return null;
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

    const result = files
      .filter(f => !f.name.endsWith('/') && f.name.endsWith('.json'))
      .map(f => {
        const date = dateFromPath(f.name);
        return {
          path: f.name,
          date,
          jobName: f.name.split('/')[4] ?? '',
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
    const todayPrefix = `${PREFIX}${today.replace(/-/g, '/')}/`;

    const [files] = await storage.bucket(BUCKET).getFiles({ prefix: todayPrefix });

    const result = files
      .filter(f => !f.name.endsWith('/') && f.name.endsWith('.json'))
      .map(f => ({
        path: f.name,
        date: today,
        jobName: f.name.split('/')[4] ?? '',
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
    res.setHeader('Cache-Control', 'public, max-age=86400');
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`GCS proxy server running on http://localhost:${PORT}`);
  console.log(`Bucket: gs://${BUCKET}/${PREFIX}`);
});

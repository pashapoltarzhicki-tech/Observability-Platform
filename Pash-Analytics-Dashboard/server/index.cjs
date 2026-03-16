const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(cors());

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
    const [content] = await file.download();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(content);
  } catch (err) {
    console.error('file error:', err.message, filePath);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`GCS proxy server running on http://localhost:${PORT}`);
  console.log(`Bucket: gs://${BUCKET}/${PREFIX}`);
});

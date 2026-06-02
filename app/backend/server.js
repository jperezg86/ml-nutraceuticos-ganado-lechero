const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const { spawn } = require('child_process');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = 3001;

// ── Rutas del proyecto ────────────────────────────────────────────────────────
const REPO_ROOT   = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, `upload_${Date.now()}.csv`)
});
const upload = multer({ storage });

// ── Helper: llamar script Python ──────────────────────────────────────────────
function runPython(script, payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [path.join(SCRIPTS_DIR, script)], {
      env: { ...process.env, REPO_ROOT }
    });
    let stdout = '', stderr = '';
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || `exit ${code}`));
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON parse error: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/health — ping
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/model-info — metadatos del modelo entrenado
app.get('/api/model-info', async (req, res) => {
  try {
    const info = await runPython('model_info.py', { repo_root: REPO_ROOT });
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predict/manual — predecir con valores manuales (JSON)
app.post('/api/predict/manual', async (req, res) => {
  try {
    const result = await runPython('predict.py', {
      repo_root: REPO_ROOT,
      mode: 'manual',
      features: req.body.features
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/predict/csv — predecir desde CSV subido
app.post('/api/predict/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const result = await runPython('predict.py', {
      repo_root: REPO_ROOT,
      mode: 'csv',
      csv_path: req.file.path
    });
    // limpiar upload
    fs.unlink(req.file.path, () => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/drift — análisis de drift en datos subidos
app.post('/api/drift', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  try {
    const result = await runPython('drift_check.py', {
      repo_root: REPO_ROOT,
      csv_path: req.file.path
    });
    fs.unlink(req.file.path, () => {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/training-stats — estadísticas de los datos de entrenamiento
app.get('/api/training-stats', async (req, res) => {
  try {
    const stats = await runPython('training_stats.py', { repo_root: REPO_ROOT });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐄 Dashboard API corriendo en http://localhost:${PORT}`);
  console.log(`   Repo: ${REPO_ROOT}\n`);
});

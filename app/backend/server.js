const express   = require('express');
const cors      = require('cors');
const multer    = require('multer');
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');
const DB        = require('./database');

const app  = express();
const PORT = 3001;

const REPO_ROOT   = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const UPLOAD_DIR  = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, `upload_${Date.now()}.csv`)
});
const upload = multer({ storage });

function runPython(script, payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [path.join(SCRIPTS_DIR, script)], {
      env: { ...process.env, REPO_ROOT }
    });
    let out = '', err = '';
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(err || `exit ${code}`));
      try { resolve(JSON.parse(out)); }
      catch(e) { reject(new Error(`JSON parse: ${out.slice(0,200)}`)); }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  const stats = DB.reg.globalStats.get();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db: DB.DB_PATH, stats });
});

// ═══════════════════════════════════════════════════════════════
// MODELO ML
// ═══════════════════════════════════════════════════════════════
app.get('/api/model-info', async (req, res) => {
  try { res.json(await runPython('model_info.py', { repo_root: REPO_ROOT })); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/training-stats', async (req, res) => {
  try { res.json(await runPython('training_stats.py', { repo_root: REPO_ROOT })); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/predict/manual
app.post('/api/predict/manual', async (req, res) => {
  const t0 = Date.now();
  try {
    const result = await runPython('predict.py', {
      repo_root: REPO_ROOT, mode: 'manual', features: req.body.features
    });
    if (result.prediction !== undefined) {
      try {
        DB.pred.insert.run({
          registro_id:   req.body.registro_id || null,
          id_vaca:       req.body.id_vaca || null,
          prediccion:    result.prediction,
          nivel_emision: result.nivel_emision,
          features_json: JSON.stringify(req.body.features || {}),
          modelo:        result.model_used || 'desconocido',
          latencia_ms:   Date.now() - t0,
        });
      } catch(e) { console.warn('DB pred:', e.message); }
    }
    res.json({ ...result, latencia_ms: Date.now() - t0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/predict/csv
app.post('/api/predict/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sin archivo' });
  try {
    const result = await runPython('predict.py', {
      repo_root: REPO_ROOT, mode: 'csv', csv_path: req.file.path
    });
    fs.unlink(req.file.path, () => {});
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// IMPORTACIÓN DE DATOS HISTÓRICOS
// ═══════════════════════════════════════════════════════════════
app.post('/api/import', async (req, res) => {
  try {
    const { force } = req.body || {};
    if (force) {
      DB.db.exec("DELETE FROM registros WHERE periodo='historico'");
    }
    const result = await runPython('import_data.py', {
      repo_root: REPO_ROOT,
      db_path:   DB.DB_PATH,
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// REGISTROS — CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/registros — últimos 200 registros
app.get('/api/registros', (req, res) => {
  try {
    res.json({
      registros: DB.reg.getRecent.all(),
      stats:     DB.reg.globalStats.get(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/registros — nuevo registro manual + auto-predicción
app.post('/api/registros', async (req, res) => {
  try {
    const b = req.body;
    const row = {
      id_vaca:            b.id_vaca            || null,
      nombre_vaca:        b.nombre_vaca        || null,
      raza:               b.raza               || null,
      sistema_produccion: b.sistema_produccion || null,
      fecha:              b.fecha              || new Date().toISOString().split('T')[0],
      anio:               b.anio               || new Date().getFullYear(),
      mes:                b.mes                || (new Date().getMonth() + 1),
      estacion:           b.estacion           || null,
      leche_kg_dia:       b.leche_kg_dia       || null,
      grasa_pct:          b.grasa_pct          || null,
      proteina_leche_pct: b.proteina_leche_pct || null,
      lactosa_pct:        b.lactosa_pct        || null,
      edad_meses:         b.edad_meses         || null,
      numero_lactancia:   b.numero_lactancia   || null,
      peso_kg:            b.peso_kg            || null,
      condicion_corporal: b.condicion_corporal || null,
      consumo_ms_kg:      b.consumo_ms_kg      || null,
      fibra_pct:          b.fibra_pct          || null,
      proteina_dieta_pct: b.proteina_dieta_pct || null,
      energia_mcal_kg:    b.energia_mcal_kg    || null,
      temperatura_c:      b.temperatura_c      || null,
      humedad_pct:        b.humedad_pct        || null,
      indice_thi:         b.indice_thi         || null,
      estres_termico:     b.estres_termico     || 0,
      mastitis:           b.mastitis           || 0,
      celulas_somaticas:  b.celulas_somaticas  || null,
      intensidad_metano:  b.intensidad_metano  || null,
      metano_g_dia:       b.metano_g_dia       || null,
      nivel_emision:      b.intensidad_metano
                          ? (b.intensidad_metano > 25 ? 'Alto' : b.intensidad_metano > 18 ? 'Medio' : 'Bajo')
                          : null,
      periodo:            'nuevo',
      fuente:             'manual',
      prediccion_ml:      null,
      notas:              b.notas || null,
    };

    const info  = DB.reg.insert.run(row);
    const saved = DB.reg.getById.get(info.lastInsertRowid);

    // Auto-predicción con ML
    let prediccion = null;
    if (b.features) {
      try {
        const t0 = Date.now();
        prediccion = await runPython('predict.py', {
          repo_root: REPO_ROOT, mode: 'manual', features: b.features
        });
        // Actualizar registro con la predicción ML
        DB.db.prepare(`UPDATE registros SET prediccion_ml=?, nivel_emision=COALESCE(nivel_emision,?) WHERE id=?`)
          .run(prediccion.prediction, prediccion.nivel_emision, info.lastInsertRowid);
        DB.pred.insert.run({
          registro_id:   info.lastInsertRowid,
          id_vaca:       row.id_vaca,
          prediccion:    prediccion.prediction,
          nivel_emision: prediccion.nivel_emision,
          features_json: JSON.stringify(b.features),
          modelo:        prediccion.model_used || 'desconocido',
          latencia_ms:   Date.now() - t0,
        });
      } catch(e) { console.warn('Auto-pred fallo:', e.message); }
    }

    res.json({ registro: saved, prediccion });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/registros/:id
app.delete('/api/registros/:id', (req, res) => {
  try {
    DB.reg.deleteById.run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// EXPLORADOR DEL HATO
// ═══════════════════════════════════════════════════════════════

// GET /api/hato/stats — dashboard general del hato
app.get('/api/hato/stats', (req, res) => {
  try {
    res.json({
      global:   DB.reg.globalStats.get(),
      razas:    DB.reg.porRaza.all(),
      niveles:  DB.reg.niveles.all(),
      alertas:  DB.reg.alertas.all(),
      tendencia: DB.reg.tendenciaGlobal.all(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/hato/vacas — lista de vacas con métricas
app.get('/api/hato/vacas', (req, res) => {
  try { res.json({ vacas: DB.reg.vacas.all() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/hato/vaca/:id — historial de una vaca
app.get('/api/hato/vaca/:id', (req, res) => {
  try {
    const rows = DB.reg.tendenciaVaca.all(req.params.id);
    res.json({ historial: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/hato/scatter?x=leche_kg_dia&y=intensidad_metano&raza=Jersey
app.get('/api/hato/scatter', (req, res) => {
  const ALLOWED = ['leche_kg_dia','indice_thi','peso_kg','consumo_ms_kg',
                   'fibra_pct','proteina_dieta_pct','temperatura_c',
                   'humedad_pct','celulas_somaticas','metano_g_dia',
                   'intensidad_metano','condicion_corporal'];
  const x    = ALLOWED.includes(req.query.x) ? req.query.x : 'leche_kg_dia';
  const y    = ALLOWED.includes(req.query.y) ? req.query.y : 'intensidad_metano';
  const raza = req.query.raza || null;
  const limit = Math.min(parseInt(req.query.limit) || 3000, 5000);

  try {
    let sql = `SELECT ${x}, ${y}, raza, id_vaca, nivel_emision
               FROM registros WHERE activo=1 AND ${x} IS NOT NULL AND ${y} IS NOT NULL`;
    const params = [];
    if (raza) { sql += ' AND raza=?'; params.push(raza); }
    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(limit);
    const rows = DB.db.prepare(sql).all(...params);
    // Renombrar a x_col/y_col para que Recharts ScatterChart los encuentre
    const data = rows.map(r => ({
      x_col:         r[x],
      y_col:         r[y],
      raza:          r.raza,
      id_vaca:       r.id_vaca,
      nivel_emision: r.nivel_emision,
    }));
    res.json({ data, x, y });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// MONITOR DE DRIFT (desde la DB)
// ═══════════════════════════════════════════════════════════════
app.get('/api/drift/db', (req, res) => {
  try {
    const historicos = DB.reg.historicosFeatures.all();
    const nuevos     = DB.reg.nuevosFeatures.all();

    if (nuevos.length < 5) {
      return res.json({
        ready: false,
        message: `Se necesitan al menos 5 registros nuevos para analizar drift. Tienes ${nuevos.length}.`,
        n_nuevos: nuevos.length,
        n_historicos: historicos.length,
      });
    }

    const cols = ['leche_kg_dia','indice_thi','consumo_ms_kg','peso_kg',
                  'fibra_pct','proteina_dieta_pct','temperatura_c','humedad_pct'];

    // KS test simplificado en JS (Mann-Whitney approx con rangos)
    function ksStat(a, b) {
      const sorted_a = [...a].filter(v => v != null).sort((x,y) => x-y);
      const sorted_b = [...b].filter(v => v != null).sort((x,y) => x-y);
      if (!sorted_a.length || !sorted_b.length) return { stat: 0, drifted: false };
      const n1 = sorted_a.length, n2 = sorted_b.length;
      let maxD = 0, i = 0, j = 0;
      while (i < n1 && j < n2) {
        const f1 = (i+1)/n1, f2 = (j+1)/n2;
        if (sorted_a[i] <= sorted_b[j]) i++; else j++;
        maxD = Math.max(maxD, Math.abs(f1 - f2));
      }
      const threshold = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));
      return { stat: parseFloat(maxD.toFixed(4)), drifted: maxD > threshold };
    }

    const details = cols.map(col => {
      const aVals = historicos.map(r => r[col]).filter(v => v != null);
      const bVals = nuevos.map(r => r[col]).filter(v => v != null);
      const ks = ksStat(aVals, bVals);
      return {
        feature:  col,
        ks_stat:  ks.stat,
        drifted:  ks.drifted,
        ref_mean: aVals.length ? parseFloat((aVals.reduce((s,v)=>s+v,0)/aVals.length).toFixed(3)) : null,
        new_mean: bVals.length ? parseFloat((bVals.reduce((s,v)=>s+v,0)/bVals.length).toFixed(3)) : null,
      };
    });

    const drifted    = details.filter(d => d.drifted).length;
    const drift_pct  = parseFloat((100 * drifted / cols.length).toFixed(1));
    const severity   = drift_pct >= 50 ? 'Crítico' : drift_pct >= 25 ? 'Alto' : drift_pct >= 10 ? 'Moderado' : 'Bajo';

    // Guardar en historial
    try {
      DB.drift.insert.run({
        nombre_fuente:     'DB automático',
        n_nuevos:          nuevos.length,
        n_historicos:      historicos.length,
        total_features:    cols.length,
        features_con_drift: drifted,
        drift_pct,
        severidad:         severity,
        resultado_json:    JSON.stringify({ details }),
      });
    } catch(e) { console.warn('drift save:', e.message); }

    res.json({
      ready: true,
      n_nuevos:      nuevos.length,
      n_historicos:  historicos.length,
      features_analizadas: cols.length,
      features_con_drift: drifted,
      drift_pct,
      severity,
      details,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/drift/historial
app.get('/api/drift/historial', (req, res) => {
  try { res.json({ historial: DB.drift.historial.all() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
})

// ═══════════════════════════════════════════════════════════════
// PREDICCIONES — historial y estadísticas
// ═══════════════════════════════════════════════════════════════
app.get('/api/predicciones', (req, res) => {
  try {
    res.json({
      predicciones: DB.pred.recientes.all(),
      stats:        DB.pred.stats.get(),
      trend:        DB.pred.trend.all(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
})

// ═══════════════════════════════════════════════════════════════
// COMPARACIÓN MODELO — predicción vs valor real (dataset procesado)
// ═══════════════════════════════════════════════════════════════
app.get('/api/comparacion', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 500;
    const result = await runPython('compare_model.py', { repo_root: REPO_ROOT, n });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🐄 Dashboard API corriendo en http://localhost:${PORT}`);
  console.log(`   Repo: ${REPO_ROOT}`);
  console.log(`   DB:   ${DB.DB_PATH}\n`);
});

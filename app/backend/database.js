/**
 * database.js — SQLite · Dashboard MetanoML
 */
const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_DIR  = path.resolve(__dirname, '../db')
const DB_PATH = path.join(DB_DIR, 'metano.db')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('cache_size = -16000')  // 16 MB cache

// ═══════════════════════════════════════════════════════════════
// ESQUEMA
// ═══════════════════════════════════════════════════════════════
db.exec(`
  CREATE TABLE IF NOT EXISTS registros (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Identificación
    id_vaca             TEXT,
    nombre_vaca         TEXT,
    raza                TEXT,
    sistema_produccion  TEXT,
    -- Temporalidad
    fecha               TEXT,
    anio                INTEGER,
    mes                 INTEGER,
    estacion            TEXT,
    -- Producción
    leche_kg_dia        REAL,
    grasa_pct           REAL,
    proteina_leche_pct  REAL,
    lactosa_pct         REAL,
    -- Animal
    edad_meses          INTEGER,
    numero_lactancia    INTEGER,
    peso_kg             REAL,
    condicion_corporal  REAL,
    -- Alimentación
    consumo_ms_kg       REAL,
    fibra_pct           REAL,
    proteina_dieta_pct  REAL,
    energia_mcal_kg     REAL,
    -- Ambiente
    temperatura_c       REAL,
    humedad_pct         REAL,
    indice_thi          REAL,
    estres_termico      INTEGER,
    -- Salud
    mastitis            INTEGER,
    celulas_somaticas   REAL,
    -- Metano (target)
    intensidad_metano   REAL,
    metano_g_dia        REAL,
    nivel_emision       TEXT,   -- 'Bajo' | 'Medio' | 'Alto'
    -- Meta
    periodo             TEXT DEFAULT 'nuevo',   -- 'historico' | 'nuevo'
    fuente              TEXT DEFAULT 'manual',  -- 'manual' | 'importacion'
    prediccion_ml       REAL,   -- predicción del modelo ML si aplica
    notas               TEXT,
    creado_en           TEXT DEFAULT (datetime('now')),
    activo              INTEGER DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_reg_vaca    ON registros(id_vaca);
  CREATE INDEX IF NOT EXISTS idx_reg_fecha   ON registros(fecha);
  CREATE INDEX IF NOT EXISTS idx_reg_periodo ON registros(periodo);
  CREATE INDEX IF NOT EXISTS idx_reg_raza    ON registros(raza);
  CREATE INDEX IF NOT EXISTS idx_reg_nivel   ON registros(nivel_emision);

  CREATE TABLE IF NOT EXISTS predicciones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_id   INTEGER REFERENCES registros(id) ON DELETE SET NULL,
    id_vaca       TEXT,
    prediccion    REAL NOT NULL,
    nivel_emision TEXT,
    features_json TEXT NOT NULL,
    modelo        TEXT DEFAULT 'E3-Ridge',
    latencia_ms   REAL,
    creado_en     TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pred_vaca  ON predicciones(id_vaca);
  CREATE INDEX IF NOT EXISTS idx_pred_fecha ON predicciones(creado_en);

  CREATE TABLE IF NOT EXISTS drift_runs (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_fuente      TEXT,
    n_nuevos           INTEGER,
    n_historicos       INTEGER,
    total_features     INTEGER,
    features_con_drift INTEGER,
    drift_pct          REAL,
    severidad          TEXT,
    resultado_json     TEXT,
    creado_en          TEXT DEFAULT (datetime('now'))
  );
`)

// ═══════════════════════════════════════════════════════════════
// QUERIES — registros
// ═══════════════════════════════════════════════════════════════
const regQ = {

  insert: db.prepare(`
    INSERT INTO registros
      (id_vaca, nombre_vaca, raza, sistema_produccion, fecha, anio, mes, estacion,
       leche_kg_dia, grasa_pct, proteina_leche_pct, lactosa_pct,
       edad_meses, numero_lactancia, peso_kg, condicion_corporal,
       consumo_ms_kg, fibra_pct, proteina_dieta_pct, energia_mcal_kg,
       temperatura_c, humedad_pct, indice_thi, estres_termico,
       mastitis, celulas_somaticas,
       intensidad_metano, metano_g_dia, nivel_emision,
       periodo, fuente, prediccion_ml, notas)
    VALUES
      (@id_vaca, @nombre_vaca, @raza, @sistema_produccion, @fecha, @anio, @mes, @estacion,
       @leche_kg_dia, @grasa_pct, @proteina_leche_pct, @lactosa_pct,
       @edad_meses, @numero_lactancia, @peso_kg, @condicion_corporal,
       @consumo_ms_kg, @fibra_pct, @proteina_dieta_pct, @energia_mcal_kg,
       @temperatura_c, @humedad_pct, @indice_thi, @estres_termico,
       @mastitis, @celulas_somaticas,
       @intensidad_metano, @metano_g_dia, @nivel_emision,
       @periodo, @fuente, @prediccion_ml, @notas)
  `),

  getRecent: db.prepare(`
    SELECT * FROM registros WHERE activo=1 ORDER BY fecha DESC, id DESC LIMIT 200
  `),

  getById: db.prepare(`SELECT * FROM registros WHERE id=?`),
  deleteById: db.prepare(`UPDATE registros SET activo=0 WHERE id=?`),

  // Stats globales
  globalStats: db.prepare(`
    SELECT
      COUNT(*)                               AS total,
      COUNT(DISTINCT id_vaca)                AS vacas,
      COUNT(DISTINCT raza)                   AS razas,
      ROUND(AVG(intensidad_metano),3)        AS metano_medio,
      ROUND(AVG(leche_kg_dia),2)             AS leche_media,
      MIN(fecha)                             AS fecha_inicio,
      MAX(fecha)                             AS fecha_fin,
      SUM(CASE WHEN periodo='historico' THEN 1 ELSE 0 END) AS n_historico,
      SUM(CASE WHEN periodo='nuevo' THEN 1 ELSE 0 END)     AS n_nuevos,
      SUM(CASE WHEN nivel_emision='Alto' THEN 1 ELSE 0 END) AS alertas
    FROM registros WHERE activo=1
  `),

  // Lista de vacas únicas con resumen
  vacas: db.prepare(`
    SELECT
      id_vaca,
      MAX(nombre_vaca)                   AS nombre_vaca,
      MAX(raza)                          AS raza,
      COUNT(*)                           AS n_visitas,
      ROUND(AVG(intensidad_metano),3)    AS metano_medio,
      ROUND(AVG(leche_kg_dia),2)         AS leche_media,
      MAX(fecha)                         AS ultima_visita,
      SUM(CASE WHEN nivel_emision='Alto' THEN 1 ELSE 0 END) AS alertas
    FROM registros WHERE activo=1 AND id_vaca IS NOT NULL
    GROUP BY id_vaca
    ORDER BY alertas DESC, metano_medio DESC
  `),

  // Tendencia de una vaca en el tiempo
  tendenciaVaca: db.prepare(`
    SELECT fecha, intensidad_metano, leche_kg_dia, peso_kg,
           indice_thi, nivel_emision, notas
    FROM registros
    WHERE id_vaca=? AND activo=1
    ORDER BY fecha ASC
  `),

  // Distribución por raza
  porRaza: db.prepare(`
    SELECT raza,
      COUNT(*)                        AS n,
      ROUND(AVG(intensidad_metano),3) AS metano_medio,
      ROUND(AVG(leche_kg_dia),2)      AS leche_media,
      SUM(CASE WHEN nivel_emision='Alto' THEN 1 ELSE 0 END) AS alertas
    FROM registros WHERE activo=1 AND raza IS NOT NULL
    GROUP BY raza ORDER BY n DESC
  `),

  // Tendencia temporal global (promedio por mes)
  tendenciaGlobal: db.prepare(`
    SELECT
      substr(fecha,1,7)               AS mes_año,
      ROUND(AVG(intensidad_metano),3) AS metano_medio,
      ROUND(AVG(leche_kg_dia),2)      AS leche_media,
      COUNT(*)                        AS n_registros,
      SUM(CASE WHEN nivel_emision='Alto' THEN 1 ELSE 0 END) AS alertas_mes
    FROM registros WHERE activo=1
    GROUP BY substr(fecha,1,7)
    ORDER BY mes_año ASC
  `),

  // Scatter: X vs Y para cualquier par de columnas (se construye dinámicamente)
  // Distribución de niveles
  niveles: db.prepare(`
    SELECT nivel_emision, COUNT(*) AS n
    FROM registros WHERE activo=1
    GROUP BY nivel_emision
  `),

  // Para drift: datos históricos
  historicosFeatures: db.prepare(`
    SELECT leche_kg_dia, indice_thi, consumo_ms_kg, peso_kg,
           fibra_pct, proteina_dieta_pct, temperatura_c, humedad_pct,
           intensidad_metano
    FROM registros
    WHERE periodo='historico' AND activo=1
    ORDER BY RANDOM() LIMIT 5000
  `),

  // Para drift: datos nuevos
  nuevosFeatures: db.prepare(`
    SELECT leche_kg_dia, indice_thi, consumo_ms_kg, peso_kg,
           fibra_pct, proteina_dieta_pct, temperatura_c, humedad_pct,
           intensidad_metano
    FROM registros
    WHERE periodo='nuevo' AND activo=1
    ORDER BY fecha DESC LIMIT 500
  `),

  // Alertas recientes
  alertas: db.prepare(`
    SELECT id_vaca, nombre_vaca, fecha, intensidad_metano, leche_kg_dia, notas
    FROM registros
    WHERE nivel_emision='Alto' AND activo=1
    ORDER BY fecha DESC LIMIT 20
  `),

  // Check si ya hay datos importados
  countHistorico: db.prepare(`SELECT COUNT(*) AS n FROM registros WHERE periodo='historico'`),
}

// ═══════════════════════════════════════════════════════════════
// QUERIES — predicciones
// ═══════════════════════════════════════════════════════════════
const predQ = {
  insert: db.prepare(`
    INSERT INTO predicciones (registro_id, id_vaca, prediccion, nivel_emision, features_json, modelo, latencia_ms)
    VALUES (@registro_id, @id_vaca, @prediccion, @nivel_emision, @features_json, @modelo, @latencia_ms)
  `),
  recientes: db.prepare(`
    SELECT id, id_vaca, prediccion, nivel_emision, modelo, creado_en
    FROM predicciones ORDER BY creado_en DESC LIMIT 50
  `),
  stats: db.prepare(`
    SELECT COUNT(*) AS total,
      ROUND(AVG(prediccion),3) AS media,
      SUM(CASE WHEN nivel_emision='Alto'  THEN 1 ELSE 0 END) AS alto,
      SUM(CASE WHEN nivel_emision='Medio' THEN 1 ELSE 0 END) AS medio,
      SUM(CASE WHEN nivel_emision='Bajo'  THEN 1 ELSE 0 END) AS bajo,
      MAX(creado_en) AS ultima
    FROM predicciones
  `),
  trend: db.prepare(`
    SELECT substr(creado_en,1,10) AS fecha,
      COUNT(*) AS n,
      ROUND(AVG(prediccion),3) AS media_dia
    FROM predicciones
    GROUP BY substr(creado_en,1,10)
    ORDER BY fecha DESC LIMIT 30
  `),
  comparacion: db.prepare(`
    SELECT id, id_vaca, fecha, raza, intensidad_metano, prediccion_ml, nivel_emision
    FROM registros
    WHERE activo=1
      AND intensidad_metano IS NOT NULL
      AND prediccion_ml IS NOT NULL
    ORDER BY RANDOM() LIMIT 1000
  `),
  sampleParaPredict: db.prepare(`
    SELECT id, id_vaca, fecha, raza, nivel_emision, intensidad_metano,
           leche_kg_dia, peso_kg, edad_meses, numero_lactancia,
           fibra_pct, proteina_dieta_pct, consumo_ms_kg,
           humedad_pct, indice_thi, temperatura_c
    FROM registros
    WHERE activo=1
      AND intensidad_metano IS NOT NULL
      AND leche_kg_dia IS NOT NULL
    ORDER BY RANDOM() LIMIT 500
  `),
}

// ═══════════════════════════════════════════════════════════════
// QUERIES — drift
// ═══════════════════════════════════════════════════════════════
const driftQ = {
  insert: db.prepare(`
    INSERT INTO drift_runs
      (nombre_fuente, n_nuevos, n_historicos, total_features, features_con_drift, drift_pct, severidad, resultado_json)
    VALUES (@nombre_fuente, @n_nuevos, @n_historicos, @total_features, @features_con_drift, @drift_pct, @severidad, @resultado_json)
  `),
  historial: db.prepare(`
    SELECT id, nombre_fuente, n_nuevos, n_historicos, drift_pct, severidad, creado_en
    FROM drift_runs ORDER BY creado_en DESC LIMIT 20
  `),
}

// ═══════════════════════════════════════════════════════════════
// BULK INSERT (transacción para importación masiva)
// ═══════════════════════════════════════════════════════════════
const bulkInsert = db.transaction((rows) => {
  for (const row of rows) regQ.insert.run(row)
  return rows.length
})

module.exports = { db, reg: regQ, pred: predQ, drift: driftQ, bulkInsert, DB_PATH }

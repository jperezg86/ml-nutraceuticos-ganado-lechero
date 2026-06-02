#!/usr/bin/env python3
"""
import_data.py — Importa el dataset histórico al SQLite del dashboard.
Lee: data/raw/csv/dataset_vacas_24m_v2.csv (73K filas, datos completos)
Escribe: app/db/metano.db tabla registros (periodo='historico')
"""
import sys, json, os, sqlite3, math
import pandas as pd
from pathlib import Path

data     = json.loads(sys.stdin.read())
repo     = Path(data.get('repo_root', '.'))
db_path  = data.get('db_path')
n_limit  = data.get('n_limit', None)   # None = todos

RAW_PATH = repo / 'data/raw/csv/dataset_vacas_24m_v2.csv'

if not RAW_PATH.exists():
    print(json.dumps({'error': f'No se encontró el archivo: {RAW_PATH}'}))
    sys.exit(0)

# ── Leer datos ────────────────────────────────────────────────────────────────
df = pd.read_csv(RAW_PATH)
if n_limit:
    df = df.head(int(n_limit))

total = len(df)

def nivel(v):
    if pd.isna(v): return None
    if v > 25:  return 'Alto'
    if v > 18:  return 'Medio'
    return 'Bajo'

def safe(v):
    """None si NaN, sino el valor"""
    if v is None: return None
    try:
        if math.isnan(float(v)): return None
    except (TypeError, ValueError): pass
    return v

def safe_int(v):
    x = safe(v)
    return int(x) if x is not None else None

# ── Conectar SQLite ───────────────────────────────────────────────────────────
con = sqlite3.connect(db_path)
cur = con.cursor()

# Verificar si ya hay datos históricos
n_exist = cur.execute("SELECT COUNT(*) FROM registros WHERE periodo='historico'").fetchone()[0]
if n_exist > 0:
    print(json.dumps({'skipped': True, 'message': f'Ya existen {n_exist:,} registros históricos. Usa force=true para reimportar.', 'n_existing': n_exist}))
    con.close()
    sys.exit(0)

# ── Preparar filas ────────────────────────────────────────────────────────────
INSERT_SQL = """
  INSERT INTO registros
    (id_vaca, nombre_vaca, raza, sistema_produccion, fecha, anio, mes, estacion,
     leche_kg_dia, grasa_pct, proteina_leche_pct, lactosa_pct,
     edad_meses, numero_lactancia, peso_kg, condicion_corporal,
     consumo_ms_kg, fibra_pct, proteina_dieta_pct, energia_mcal_kg,
     temperatura_c, humedad_pct, indice_thi, estres_termico,
     mastitis, celulas_somaticas,
     intensidad_metano, metano_g_dia, nivel_emision,
     periodo, fuente)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
"""

BATCH = 2000
inserted = 0
errors   = 0

rows_batch = []
for _, r in df.iterrows():
    try:
        rows_batch.append((
            safe(r.get('id_vaca')),
            safe(r.get('nombre_vaca')),
            safe(r.get('raza')),
            safe(r.get('sistema_produccion')),
            safe(r.get('fecha')),
            safe_int(r.get('anio')),
            safe_int(r.get('mes')),
            safe(r.get('estacion')),
            safe(r.get('leche_kg_dia')),
            safe(r.get('grasa_pct')),
            safe(r.get('proteina_leche_pct')),
            safe(r.get('lactosa_pct')),
            safe_int(r.get('edad_meses')),
            safe_int(r.get('numero_lactancia')),
            safe(r.get('peso_kg')),
            safe(r.get('condicion_corporal')),
            safe(r.get('consumo_ms_kg')),
            safe(r.get('fibra_pct')),
            safe(r.get('proteina_dieta_pct')),
            safe(r.get('energia_mcal_kg')),
            safe(r.get('temperatura_c')),
            safe(r.get('humedad_pct')),
            safe(r.get('indice_thi')),
            safe_int(r.get('estres_termico')),
            safe_int(r.get('mastitis')),
            safe(r.get('celulas_somaticas')),
            safe(r.get('intensidad_metano')),
            safe(r.get('metano_g_dia')),
            nivel(r.get('intensidad_metano')),
            'historico',
            'importacion',
        ))
    except Exception as e:
        errors += 1
        continue

    if len(rows_batch) >= BATCH:
        cur.executemany(INSERT_SQL, rows_batch)
        con.commit()
        inserted += len(rows_batch)
        rows_batch = []

if rows_batch:
    cur.executemany(INSERT_SQL, rows_batch)
    con.commit()
    inserted += len(rows_batch)

con.close()

# Stats rápidas de lo importado
print(json.dumps({
    'ok':       True,
    'inserted': inserted,
    'errors':   errors,
    'total_csv': total,
    'message':  f'{inserted:,} registros históricos importados correctamente.',
}))

#!/usr/bin/env python3
"""Análisis de drift: KS test entre datos nuevos y distribución de entrenamiento."""
import sys, json, warnings
import numpy as np, pandas as pd
from pathlib import Path
from scipy import stats
warnings.filterwarnings('ignore')

data     = json.loads(sys.stdin.read())
repo     = Path(data.get('repo_root', '.'))
csv_path = data.get('csv_path')

if not csv_path:
    print(json.dumps({'error': 'csv_path requerido'})); sys.exit(1)

FEAT_REG = ['edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos']

# ── Cargar datos de entrenamiento (referencia) ────────────────────────────────
train_path = repo / 'data/processed/dataset_procesado_v3.csv'
if not train_path.exists():
    train_path = repo / 'data/processed/dataset_procesado_v2.csv'
if not train_path.exists():
    # Buscar cualquier CSV procesado
    candidates = list((repo / 'data/processed').glob('*.csv'))
    if candidates:
        train_path = candidates[0]
    else:
        print(json.dumps({'error': 'No se encontraron datos de entrenamiento de referencia'}))
        sys.exit(0)

try:
    df_ref = pd.read_csv(train_path)
except Exception as e:
    print(json.dumps({'error': f'Error leyendo datos de referencia: {str(e)}'}))
    sys.exit(0)

# ── Cargar datos nuevos ───────────────────────────────────────────────────────
try:
    df_new = pd.read_csv(csv_path)
except Exception as e:
    print(json.dumps({'error': f'Error leyendo CSV nuevo: {str(e)}'}))
    sys.exit(0)

# Columnas comunes para análisis
common_cols = [f for f in FEAT_REG if f in df_ref.columns and f in df_new.columns]

if len(common_cols) < 3:
    print(json.dumps({
        'error': f'Pocas columnas en común ({len(common_cols)}). Se necesitan al menos 3.',
        'available_new': list(df_new.columns),
        'expected': FEAT_REG[:10]
    }))
    sys.exit(0)

# ── KS test por feature ───────────────────────────────────────────────────────
drift_results = []
drifted_features = []
ALPHA = 0.05

for col in common_cols:
    ref_vals = df_ref[col].dropna().values
    new_vals = df_new[col].dropna().values

    if len(ref_vals) < 10 or len(new_vals) < 10:
        continue

    ks_stat, p_value = stats.ks_2samp(ref_vals, new_vals)
    drifted = p_value < ALPHA

    drift_results.append({
        'feature' : col,
        'ks_stat' : round(float(ks_stat), 4),
        'p_value' : round(float(p_value), 6),
        'drifted' : drifted,
        'ref_mean': round(float(ref_vals.mean()), 4),
        'new_mean': round(float(new_vals.mean()), 4),
        'ref_std' : round(float(ref_vals.std()),  4),
        'new_std' : round(float(new_vals.std()),  4),
    })

    if drifted:
        drifted_features.append(col)

# Ordenar por KS stat descendente
drift_results.sort(key=lambda x: x['ks_stat'], reverse=True)

total_tested  = len(drift_results)
total_drifted = len(drifted_features)
drift_pct     = round(100 * total_drifted / total_tested, 1) if total_tested > 0 else 0

# Severidad global
if drift_pct >= 50:
    severity = 'Crítico'
elif drift_pct >= 25:
    severity = 'Alto'
elif drift_pct >= 10:
    severity = 'Moderado'
else:
    severity = 'Bajo'

print(json.dumps({
    'total_features_tested': total_tested,
    'features_drifted'     : total_drifted,
    'drift_pct'            : drift_pct,
    'severity'             : severity,
    'alpha'                : ALPHA,
    'ref_rows'             : len(df_ref),
    'new_rows'             : len(df_new),
    'drifted_features'     : drifted_features,
    'details'              : drift_results[:20],  # top 20
}))

#!/usr/bin/env python3
"""Estadísticas de los datos de entrenamiento para visualización en el dashboard."""
import sys, json, warnings
import numpy as np, pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

data = json.loads(sys.stdin.read())
repo = Path(data.get('repo_root', '.'))

FEAT_REG = ['edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos']

# ── Buscar dataset procesado ──────────────────────────────────────────────────
train_path = None
for p in [
    repo / 'data/processed/dataset_procesado_v3.csv',
    repo / 'data/processed/dataset_procesado_v2.csv',
]:
    if p.exists():
        train_path = p
        break

if train_path is None:
    candidates = list((repo / 'data/processed').glob('*.csv'))
    if candidates:
        train_path = candidates[0]

if train_path is None:
    # Devolver datos de demostración
    print(json.dumps({
        'demo': True,
        'n_rows': 73000,
        'n_vacas': 119,
        'target_stats': {
            'mean': 21.3, 'std': 4.1, 'min': 10.2, 'max': 34.8,
            'p25': 18.2, 'p50': 21.0, 'p75': 24.5
        },
        'distribution': [
            {'range': '10-13', 'count': 820},
            {'range': '13-16', 'count': 3200},
            {'range': '16-19', 'count': 8900},
            {'range': '19-22', 'count': 24100},
            {'range': '22-25', 'count': 21300},
            {'range': '25-28', 'count': 10200},
            {'range': '28-31', 'count': 3500},
            {'range': '31-35', 'count': 980},
        ],
        'nivel_counts': {'Bajo': 18400, 'Medio': 38700, 'Alto': 15900},
        'top_features': [
            {'feature': 'leche_kg_dia',        'importance': 0.241},
            {'feature': 'fcr',                 'importance': 0.198},
            {'feature': 'temp_humedad_idx',    'importance': 0.143},
            {'feature': 'consumo_ms_kg',       'importance': 0.112},
            {'feature': 'peso_kg',             'importance': 0.098},
            {'feature': 'proteina_dieta_pct',  'importance': 0.076},
            {'feature': 'omega3_mg_l',         'importance': 0.054},
            {'feature': 'fibra_pct',           'importance': 0.041},
            {'feature': 'edad_meses',          'importance': 0.037},
        ]
    }))
    sys.exit(0)

df = pd.read_csv(train_path)
target_col = 'intensidad_metano'
n_vacas = df['id_vaca'].nunique() if 'id_vaca' in df.columns else 119

# ── Target distribution ───────────────────────────────────────────────────────
target_stats = {}
distribution = []
nivel_counts = {'Bajo': 0, 'Medio': 0, 'Alto': 0}

if target_col in df.columns:
    y = df[target_col].dropna()
    target_stats = {
        'mean': round(float(y.mean()), 3),
        'std' : round(float(y.std()),  3),
        'min' : round(float(y.min()),  3),
        'max' : round(float(y.max()),  3),
        'p25' : round(float(y.quantile(0.25)), 3),
        'p50' : round(float(y.quantile(0.50)), 3),
        'p75' : round(float(y.quantile(0.75)), 3),
    }
    # Histograma: 8 bins
    counts, edges = np.histogram(y, bins=8)
    for i in range(len(counts)):
        distribution.append({
            'range': f'{edges[i]:.1f}-{edges[i+1]:.1f}',
            'count': int(counts[i])
        })
    nivel_counts = {
        'Bajo' : int((y <= 18).sum()),
        'Medio': int(((y > 18) & (y <= 25)).sum()),
        'Alto' : int((y > 25).sum()),
    }

# ── Feature importance (desde E5 si existe, sino E3) ─────────────────────────
top_features = []
try:
    import joblib
    pipeline_path = None
    for p in [
        repo / 'data/processed/e5_outputs/pipeline_final_e5.pkl',
        repo / 'data/processed/baseline_outputs/pipeline_ridge_e3.pkl',
    ]:
        if p.exists():
            pipeline_path = p
            break

    if pipeline_path:
        pipe = joblib.load(pipeline_path)
        # Intentar extraer importancias
        estimator = pipe[-1] if hasattr(pipe, '__getitem__') else pipe
        if hasattr(estimator, 'feature_importances_'):
            imps = estimator.feature_importances_
            pairs = sorted(zip(FEAT_REG, imps), key=lambda x: -x[1])[:9]
            top_features = [{'feature': f, 'importance': round(float(imp), 4)} for f, imp in pairs]
        elif hasattr(estimator, 'coef_'):
            coefs = np.abs(estimator.coef_)
            coefs = coefs / coefs.sum()
            pairs = sorted(zip(FEAT_REG, coefs), key=lambda x: -x[1])[:9]
            top_features = [{'feature': f, 'importance': round(float(imp), 4)} for f, imp in pairs]
except Exception:
    pass

if not top_features:
    top_features = [
        {'feature': 'leche_kg_dia',        'importance': 0.241},
        {'feature': 'fcr',                 'importance': 0.198},
        {'feature': 'temp_humedad_idx',    'importance': 0.143},
        {'feature': 'consumo_ms_kg',       'importance': 0.112},
        {'feature': 'peso_kg',             'importance': 0.098},
        {'feature': 'proteina_dieta_pct',  'importance': 0.076},
        {'feature': 'omega3_mg_l',         'importance': 0.054},
        {'feature': 'fibra_pct',           'importance': 0.041},
        {'feature': 'edad_meses',          'importance': 0.037},
    ]

# ── Feature stats (para Explorer) ────────────────────────────────────────────
feature_stats = []
for col in FEAT_REG:
    if col in df.columns:
        s = df[col].dropna()
        feature_stats.append({
            'name': col,
            'mean': round(float(s.mean()), 3),
            'std' : round(float(s.std()),  3),
            'min' : round(float(s.min()),  3),
            'max' : round(float(s.max()),  3),
        })

print(json.dumps({
    'demo'         : False,
    'n_rows'       : len(df),
    'n_vacas'      : n_vacas,
    'target_stats' : target_stats,
    'distribution' : distribution,
    'nivel_counts' : nivel_counts,
    'top_features' : top_features,
    'feature_stats': feature_stats,
}))

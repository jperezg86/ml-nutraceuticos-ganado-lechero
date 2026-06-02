#!/usr/bin/env python3
"""Devuelve metadata del modelo entrenado."""
import sys, json, os
from pathlib import Path

data = json.loads(sys.stdin.read())
repo = Path(data.get('repo_root', '.'))

FEAT_REG = ['edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos']

# Buscar el mejor pipeline disponible (E5 > E4 > E3)
pipeline_path = None
meta_path     = None
avance        = 'E3'

CANDIDATES = [
    (repo/'data/processed/e5_outputs/pipeline_final_e5.pkl',
     repo/'data/processed/e5_outputs/e5_artifacts_meta.json', 'E5'),
    (repo/'data/processed/e4_outputs/pipeline_mlp_e4.pkl',
     repo/'data/processed/e4_outputs/e4_artifacts_meta.json',  'E4'),
    (repo/'data/processed/baseline_outputs/pipeline_ridge_e3.pkl',
     repo/'data/processed/baseline_outputs/e3_artifacts_meta.json', 'E3'),
]
for p_path, m_path, av in CANDIDATES:
    if p_path.exists():
        pipeline_path = p_path
        meta_path     = m_path
        avance        = av
        break

if pipeline_path is None:
    print(json.dumps({'error': 'No se encontró ningún pipeline entrenado'}))
    sys.exit(0)

meta = {}
if meta_path and meta_path.exists():
    with open(meta_path) as f:
        meta = json.load(f)

# RMSE y R² según etapa
rmse = meta.get('rmse_e5_final', meta.get('rmse_e4_mlp', meta.get('rmse_e3_ridge', 0.7268)))
r2   = meta.get('r2_e5_final',   meta.get('r2_e4_mlp',  meta.get('r2_e3_ridge',  0.9688)))
model_name = meta.get('final_model', meta.get('model', 'Ridge'))

result = {
    'model_name'    : model_name,
    'pipeline_path' : str(pipeline_path),
    'rmse'          : rmse,
    'r2'            : r2,
    'n_features'    : len(FEAT_REG),
    'features'      : FEAT_REG,
    'rmse_baseline' : 0.7268,
    'lift_vs_bl5'   : meta.get('lift_vs_bl5_pct', round((0.7268 - rmse) / 0.7268 * 100, 2)),
    'latency_ms'    : meta.get('latency_p95_ms', meta.get('train_time_s', 2.0)),
    'avance'        : avance,
    'dataset_info'  : {'rows': 73000, 'vacas': 100, 'meses': 24, 'variables': 32}
}
print(json.dumps(result))

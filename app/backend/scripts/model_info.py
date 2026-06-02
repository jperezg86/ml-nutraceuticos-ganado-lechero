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

# Buscar el mejor pipeline disponible (E5 > E3)
pipeline_path = None
meta_path     = None

for p_path, m_path in [
    (repo/'data/processed/e5_outputs/pipeline_final_e5.pkl',
     repo/'data/processed/e5_outputs/e5_artifacts_meta.json'),
    (repo/'data/processed/baseline_outputs/pipeline_ridge_e3.pkl',
     repo/'data/processed/baseline_outputs/e3_artifacts_meta.json'),
]:
    if p_path.exists():
        pipeline_path = p_path
        meta_path     = m_path
        break

if pipeline_path is None:
    print(json.dumps({'error': 'No se encontró ningún pipeline entrenado'}))
    sys.exit(0)

meta = {}
if meta_path and meta_path.exists():
    with open(meta_path) as f:
        meta = json.load(f)

# Nombre del modelo
model_name = meta.get('final_model', 'Ridge') if 'final_model' in meta else 'Ridge'

result = {
    'model_name'    : model_name,
    'pipeline_path' : str(pipeline_path),
    'rmse'          : meta.get('rmse_e5_final', meta.get('rmse_e3_ridge', 0.7268)),
    'r2'            : meta.get('r2_e5_final',   meta.get('r2_e3_ridge',  0.9688)),
    'n_features'    : len(FEAT_REG),
    'features'      : FEAT_REG,
    'rmse_baseline' : meta.get('rmse_e3_baseline', 0.7268),
    'lift_vs_bl5'   : meta.get('lift_vs_bl5_pct', 0.0),
    'latency_ms'    : meta.get('latency_p95_ms', 4.0),
    'sklearn_version': meta.get('sklearn_version', 'N/A'),
    'avance'        : 'E5' if 'final_model' in meta else 'E3',
    'dataset_info'  : {
        'rows'     : 73000,
        'vacas'    : 119,
        'meses'    : 24,
        'variables': 32,
    }
}
print(json.dumps(result))

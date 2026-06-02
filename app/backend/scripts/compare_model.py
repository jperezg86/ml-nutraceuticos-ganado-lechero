#!/usr/bin/env python3
"""
Compara predicciones del modelo vs valores reales usando el dataset procesado
(que ya contiene todas las features engineered, igual que el entrenamiento).
"""
import sys, json, warnings
import numpy as np, pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

data     = json.loads(sys.stdin.read())
repo     = Path(data.get('repo_root', '.'))
n_sample = int(data.get('n', 500))

FEAT_REG = ['edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos']

# -- Cargar pipeline
import joblib
pipeline = None
pipeline_name = 'desconocido'
for p_path, name in [
    (repo/'data/processed/e5_outputs/pipeline_final_e5.pkl',        'E5-Final'),
    (repo/'data/processed/e4_outputs/pipeline_mlp_e4.pkl',          'E4-MLP'),
    (repo/'data/processed/baseline_outputs/pipeline_ridge_e3.pkl',  'E3-Ridge'),
]:
    if p_path.exists():
        pipeline = joblib.load(p_path)
        pipeline_name = name
        break

if pipeline is None:
    print(json.dumps({'error': 'Pipeline no encontrado.'}))
    sys.exit(0)

# -- Leer CSV procesado (tiene todas las features engineered)
csv_path = repo / 'data/processed/dataset_vacas_24m_feature_engineering.csv'
if not csv_path.exists():
    print(json.dumps({'error': f'CSV procesado no encontrado: {csv_path}'}))
    sys.exit(0)

df = pd.read_csv(csv_path)
df = df[df['intensidad_metano'].notna()].copy()

# Muestra estratificada por nivel
bajo  = df[df['intensidad_metano'] <= 18]
medio = df[(df['intensidad_metano'] > 18) & (df['intensidad_metano'] <= 25)]
alto  = df[df['intensidad_metano'] > 25]
n_cada = max(1, n_sample // 3)
sample = pd.concat([
    bajo.sample(min(n_cada, len(bajo)),   random_state=42),
    medio.sample(min(n_cada, len(medio)), random_state=42),
    alto.sample(min(n_cada, len(alto)),   random_state=42),
]).sample(frac=1, random_state=42).reset_index(drop=True)

for f in FEAT_REG:
    if f not in sample.columns:
        sample[f] = 0.0

X     = sample[FEAT_REG].fillna(0).values
preds = pipeline.predict(X).tolist()
real  = sample['intensidad_metano'].tolist()

# Metadatos desde raw CSV
raw_csv = repo / 'data/raw/csv/dataset_vacas_24m_v2.csv'
id_vacas, fechas, razas = [], [], []
if raw_csv.exists():
    raw_df = pd.read_csv(raw_csv, usecols=['id_vaca','fecha','raza'])
    for idx in sample.index:
        if idx < len(raw_df):
            id_vacas.append(str(raw_df.at[idx, 'id_vaca']))
            fechas.append(str(raw_df.at[idx, 'fecha']))
            razas.append(str(raw_df.at[idx, 'raza']))
        else:
            id_vacas.append(f'row_{idx}')
            fechas.append('')
            razas.append('')
else:
    id_vacas = [f'row_{i}' for i in range(len(sample))]
    fechas = [''] * len(sample)
    razas  = [''] * len(sample)

def nivel(v):
    return 'Alto' if v > 25 else ('Medio' if v > 18 else 'Bajo')

results = [{'id_vaca': id_vacas[i], 'fecha': fechas[i], 'raza': razas[i],
            'real': round(float(real[i]),3), 'predicho': round(float(preds[i]),3),
            'residuo': round(float(real[i])-float(preds[i]),3),
            'nivel_real': nivel(real[i]), 'nivel_pred': nivel(preds[i])}
           for i in range(len(real))]

residuos = np.array([x['residuo'] for x in results])
real_arr = np.array(real)
mae  = float(np.mean(np.abs(residuos)))
rmse = float(np.sqrt(np.mean(residuos**2)))
r_mean = float(np.mean(real_arr))
ss_tot = float(np.sum((real_arr - r_mean)**2))
ss_res = float(np.sum(residuos**2))
r2 = float(1 - ss_res/ss_tot) if ss_tot > 0 else 0.0

print(json.dumps({'ready': True, 'n': len(results), 'model_used': pipeline_name,
    'data': results,
    'stats': {'mae': round(mae,3), 'rmse': round(rmse,3), 'r2': round(r2,4), 'n': len(results)}}))

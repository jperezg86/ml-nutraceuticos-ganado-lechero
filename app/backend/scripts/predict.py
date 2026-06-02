#!/usr/bin/env python3
"""Motor de predicción — modo manual (JSON) o CSV."""
import sys, json, warnings
import numpy as np, pandas as pd
from pathlib import Path
warnings.filterwarnings('ignore')

data     = json.loads(sys.stdin.read())
repo     = Path(data.get('repo_root', '.'))
mode     = data.get('mode', 'manual')

FEAT_REG = ['edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos']

# ── Cargar pipeline ──────────────────────────────────────────────────────────
import joblib
pipeline = None
pipeline_name = 'desconocido'
for p_path, name in [
    (repo/'data/processed/e5_outputs/pipeline_final_e5.pkl',   'E5-Final'),
    (repo/'data/processed/baseline_outputs/pipeline_ridge_e3.pkl', 'E3-Ridge'),
]:
    if p_path.exists():
        pipeline = joblib.load(p_path)
        pipeline_name = name
        break

if pipeline is None:
    print(json.dumps({'error': 'Pipeline no encontrado. Ejecuta el notebook E3 primero.'}))
    sys.exit(0)

# ── Modo manual ──────────────────────────────────────────────────────────────
if mode == 'manual':
    feats = data.get('features', {})
    row   = [float(feats.get(f, 0.0)) for f in FEAT_REG]
    X     = np.array(row).reshape(1, -1)
    pred  = float(pipeline.predict(X)[0])
    nivel = 'Alto' if pred > 25 else ('Medio' if pred > 18 else 'Bajo')
    print(json.dumps({
        'prediction'   : round(pred, 3),
        'unit'         : 'g CH4/kg leche',
        'nivel_emision': nivel,
        'model_used'   : pipeline_name,
        'features_used': FEAT_REG,
    }))

# ── Modo CSV ─────────────────────────────────────────────────────────────────
elif mode == 'csv':
    csv_path = data.get('csv_path')
    if not csv_path:
        print(json.dumps({'error': 'csv_path requerido'})); sys.exit(1)

    df = pd.read_csv(csv_path)

    # Verificar columnas disponibles
    missing = [f for f in FEAT_REG if f not in df.columns]
    present = [f for f in FEAT_REG if f in df.columns]

    if len(present) < 5:
        print(json.dumps({'error': f'CSV no tiene columnas del modelo. Faltantes: {missing[:5]}...'}))
        sys.exit(0)

    # Rellenar faltantes con 0
    for f in missing:
        df[f] = 0.0

    X = df[FEAT_REG].fillna(0).values
    preds = pipeline.predict(X).tolist()

    # Estadísticas resumen
    p_arr = np.array(preds)

    results = []
    for i, (_, row_df) in enumerate(df.iterrows()):
        nivel = 'Alto' if preds[i] > 25 else ('Medio' if preds[i] > 18 else 'Bajo')
        r = {'id': i+1, 'prediccion': round(preds[i], 3), 'nivel': nivel}
        for col in ['id_vaca','fecha','raza'] :
            if col in df.columns:
                r[col] = str(row_df[col])
        results.append(r)

    print(json.dumps({
        'total_rows'  : len(results),
        'model_used'  : pipeline_name,
        'missing_cols': missing,
        'present_cols': len(present),
        'results'     : results[:500],  # max 500 filas al frontend
        'stats': {
            'mean'  : round(float(p_arr.mean()), 3),
            'std'   : round(float(p_arr.std()),  3),
            'min'   : round(float(p_arr.min()),  3),
            'max'   : round(float(p_arr.max()),  3),
            'p25'   : round(float(np.percentile(p_arr, 25)), 3),
            'p50'   : round(float(np.percentile(p_arr, 50)), 3),
            'p75'   : round(float(np.percentile(p_arr, 75)), 3),
            'alto'  : int((p_arr > 25).sum()),
            'medio' : int(((p_arr > 18) & (p_arr <= 25)).sum()),
            'bajo'  : int((p_arr <= 18).sum()),
        }
    }))

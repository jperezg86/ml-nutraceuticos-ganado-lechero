#!/usr/bin/env python3
"""
Reentrena el pipeline MLP usando datos RAW del SQLite.
El pipeline guardado por el notebook E4 fue entrenado con datos ya z-scored,
por lo que no puede recibir valores crudos directamente.

Este script:
1. Carga los registros históricos importados desde SQLite
2. Computa las 28 features de ingeniería desde valores crudos
3. Entrena Pipeline(StandardScaler → MLP) con datos sin escalar
4. Guarda pipeline_mlp_app.pkl — usado por predict.py para inputs manuales
5. Registra parámetros, métricas y artefactos en MLflow
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import warnings
from pathlib import Path
from tempfile import TemporaryDirectory

import joblib

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ml_nutraceuticos_ganado_lechero.data import load_raw_training_data
from ml_nutraceuticos_ganado_lechero.features import FEAT_REG, select_training_matrix
from ml_nutraceuticos_ganado_lechero.training import train_test_pipeline

try:
    import mlflow
    import mlflow.sklearn
except ImportError:  # pragma: no cover - the project installs mlflow via requirements
    mlflow = None

warnings.filterwarnings('ignore')

DB = REPO / 'app' / 'db' / 'metano.db'
OUT = REPO / 'data' / 'processed' / 'e4_outputs' / 'pipeline_mlp_app.pkl'
MLFLOW_DIR = REPO / 'mlruns'
EXPERIMENT_NAME = os.getenv('MLFLOW_EXPERIMENT_NAME', 'metano-ml-e4-mlp-raw')

print(f'Cargando datos desde {DB}...')
df = load_raw_training_data(DB)
print(f'Registros cargados: {len(df)}')

X, y = select_training_matrix(df)
print(f'Shape X: {X.shape}, Shape y: {y.shape}')
print(f'Stats target: mean={y.mean():.2f}, std={y.std():.2f}, min={y.min():.2f}, max={y.max():.2f}')
print(f'FCR range: {X[:, FEAT_REG.index("fcr")].min():.3f} – {X[:, FEAT_REG.index("fcr")].max():.3f}')
print(f'edad_meses range: {X[:, 0].min():.0f} – {X[:, 0].max():.0f}')

print('\nEntrenando pipeline con datos raw (esto tarda ~30-60s)...')
result = train_test_pipeline(X, y, test_size=0.2, random_state=42)

print('\n✅ Resultados en test set:')
print(f'   RMSE = {result.rmse:.4f}')
print(f'   R²   = {result.r2:.4f}')

OUT.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(result.pipeline, OUT)
print(f'\n✅ Pipeline guardado en: {OUT}')

git_commit = None
try:
    git_commit = subprocess.check_output(
        ['git', 'rev-parse', '--short', 'HEAD'],
        cwd=REPO,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    git_commit = None

tracking_uri = os.getenv('MLFLOW_TRACKING_URI')
if tracking_uri is None:
    tracking_uri = MLFLOW_DIR.resolve().as_uri()

if mlflow is not None:
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(EXPERIMENT_NAME)
    with mlflow.start_run(run_name=os.getenv('MLFLOW_RUN_NAME', 'retrain_pipeline_raw')):
        mlflow.set_tags(
            {
                'project': 'ml-nutraceuticos-ganado-lechero',
                'stage': 'E4',
                'model_family': 'MLPRegressor',
                'artifact_path': str(OUT.relative_to(REPO)),
            }
        )
        if git_commit:
            mlflow.set_tag('git_commit', git_commit)

        mlflow.log_params(
            {
                'hidden_layer_sizes': '(256, 128, 64)',
                'activation': 'relu',
                'solver': 'adam',
                'alpha': 0.001,
                'batch_size': 512,
                'max_iter': 300,
                'early_stopping': True,
                'n_iter_no_change': 15,
                'random_state': 42,
                'test_size': 0.2,
                'features_count': len(FEAT_REG),
                'rows_total': len(df),
            }
        )
        mlflow.log_metrics(
            {
                'rmse': float(result.rmse),
                'r2': float(result.r2),
                'train_rows': float(len(result.X_train)),
                'test_rows': float(len(result.X_test)),
            }
        )
        with TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            (tmp / 'feature_names.txt').write_text('\n'.join(FEAT_REG), encoding='utf-8')
            (tmp / 'run_summary.json').write_text(
                json.dumps(
                    {
                        'rmse': float(result.rmse),
                        'r2': float(result.r2),
                        'features': FEAT_REG,
                        'pipeline_path': str(OUT),
                    },
                    indent=2,
                    ensure_ascii=False,
                ),
                encoding='utf-8',
            )
            mlflow.log_artifact(str(tmp / 'feature_names.txt'))
            mlflow.log_artifact(str(tmp / 'run_summary.json'))
        mlflow.sklearn.log_model(result.pipeline, artifact_path='model')
        mlflow.log_artifact(str(OUT), artifact_path='exports')
        print(f'\n✅ MLflow run logged in experiment: {EXPERIMENT_NAME}')
        print(f'   Tracking URI: {tracking_uri}')
else:
    print('\n⚠️  MLflow no está instalado; se omitió el tracking del experimento.')

SAMPLE_DEFAULTS = {
    'leche_kg_dia': 25,
    'consumo_ms_kg': 20,
    'fcr': 1.2,
    'temp_humedad_idx': 72,
    'humedad_pct': 65,
    'peso_kg': 550,
    'edad_meses': 36,
    'numero_lactancia': 2,
    'fibra_pct': 18,
    'proteina_dieta_pct': 16.5,
    'energia_mcal_kg': 3.8,
    'omega3_mg_l': 0,
    'antioxidantes_ppm': 0,
    'tiene_taninos': 0,
    'tiene_algas': 0,
    'sistema_prod_ord': 1,
    'estres_termico': 0,
    'thi_bin_ord': 0,
    'thi_stress_load': 0,
    'edad_est_ord': 1,
    'fcr_bin_ord': 2,
    'ratio_fibra_proteina': 1.09,
    'ratio_proteina_energia': 4.34,
    'leche_por_lactancia': 50,
    'mes_sin': 0.5,
    'mes_cos': 0.866,
    'indice_thi': 72,
    'omega3_por_leche': 0,
    'combo_anti_metano': 0,
}
row = [float(SAMPLE_DEFAULTS.get(feature, 0)) for feature in FEAT_REG]
sanity = float(result.pipeline.predict([row])[0])
print(f'\n🔬 Sanity check (valores default del form):')
print(f'   Predicción = {sanity:.3f} g CH₄/kg leche')
print(f"   Nivel = {'Alto' if sanity > 25 else ('Medio' if sanity > 18 else 'Bajo')}")
print(f"   {'✅ OK (dentro de rango real 8-40)' if 8 < sanity < 40 else '⚠️  FUERA DE RANGO — revisar features'}")

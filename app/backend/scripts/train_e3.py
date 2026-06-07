#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import warnings
from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
import numpy as np
from scipy.stats import ks_2samp
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ml_nutraceuticos_ganado_lechero.experiments import build_xy_from_raw_df, load_raw_csv, split_by_group
from ml_nutraceuticos_ganado_lechero.features import FEAT_REG

try:
    import mlflow
    import mlflow.sklearn
    from mlflow.models import infer_signature
except ImportError:  # pragma: no cover
    mlflow = None

warnings.filterwarnings('ignore')

RANDOM_SEED = 42
RAW_CSV = REPO / 'data' / 'raw' / 'csv' / 'dataset_vacas_24m_v2.csv'
OUT = REPO / 'data' / 'processed' / 'baseline_outputs' / 'pipeline_ridge_e3.pkl'
META_OUT = REPO / 'data' / 'processed' / 'baseline_outputs' / 'e3_artifacts_meta.json'
EXPERIMENT_NAME = os.getenv('MLFLOW_EXPERIMENT_NAME', 'metano-ml-e3-ridge')
MLFLOW_DIR = REPO / 'mlruns'

print(f'Cargando dataset raw desde {RAW_CSV}...')
df = load_raw_csv(RAW_CSV)
features_df, X, y = build_xy_from_raw_df(df)
train_df, test_df = split_by_group(features_df, group_col='id_vaca', test_size=0.2, random_state=RANDOM_SEED)
_, X_train, y_train = build_xy_from_raw_df(train_df)
_, X_test, y_test = build_xy_from_raw_df(test_df)

groups_train = train_df['id_vaca']
groups_test = test_df['id_vaca']
n_vacas_train = int(groups_train.nunique()) if 'id_vaca' in train_df.columns else 0
n_vacas_test = int(groups_test.nunique()) if 'id_vaca' in test_df.columns else 0

pipeline = Pipeline(
    [
        ('scaler', StandardScaler()),
        ('ridge', Ridge(alpha=1.0)),
    ]
)

print('Entrenando baseline Ridge E3...')
pipeline.fit(X_train, y_train)
pred = pipeline.predict(X_test)
rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
r2 = float(r2_score(y_test, pred))
ks_pvalue = float(ks_2samp(y_train, y_test).pvalue)

OUT.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(pipeline, OUT)
print(f'✅ Pipeline Ridge E3 exportado → {OUT}')

meta = {
    'sklearn_version': __import__('sklearn').__version__,
    'pandas_version': __import__('pandas').__version__,
    'numpy_version': __import__('numpy').__version__,
    'random_seed': RANDOM_SEED,
    'n_features_reg': len(FEAT_REG),
    'feature_names': FEAT_REG,
    'ridge_alpha': 1.0,
    'rmse_e3_ridge': rmse,
    'r2_e3_ridge': r2,
    'train_rows': int(len(train_df)),
    'test_rows': int(len(test_df)),
    'ks_pvalue_drift': ks_pvalue,
    'n_vacas_train': n_vacas_train,
    'n_vacas_test': n_vacas_test,
}
META_OUT.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'✅ Metadata exportada → {META_OUT}')

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
    with mlflow.start_run(run_name=os.getenv('MLFLOW_RUN_NAME', 'train_e3_ridge')):
        mlflow.set_tags(
            {
                'project': 'ml-nutraceuticos-ganado-lechero',
                'stage': 'E3',
                'model_family': 'Ridge',
                'artifact_path': str(OUT.relative_to(REPO)),
            }
        )
        if git_commit:
            mlflow.set_tag('git_commit', git_commit)
        mlflow.log_params({'ridge_alpha': 1.0, 'random_seed': RANDOM_SEED, 'test_size': 0.2, 'split': 'group_by_id_vaca'})
        mlflow.log_metrics({'rmse': rmse, 'r2': r2, 'ks_pvalue_drift': ks_pvalue})
        with TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            (tmp / 'feature_names.txt').write_text('\n'.join(FEAT_REG), encoding='utf-8')
            (tmp / 'meta.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
            mlflow.log_artifact(str(tmp / 'feature_names.txt'))
            mlflow.log_artifact(str(tmp / 'meta.json'))
        input_example = X_test.head(3)
        signature = infer_signature(X_train.head(3), pred[:3])
        mlflow.sklearn.log_model(
            pipeline,
            artifact_path='model',
            input_example=input_example,
            signature=signature,
        )
        mlflow.log_artifact(str(OUT), artifact_path='exports')
        print(f'✅ MLflow run logged in experiment: {EXPERIMENT_NAME}')
        print(f'   Tracking URI: {tracking_uri}')
else:
    print('⚠️  MLflow no está instalado; se omitió el tracking del experimento.')

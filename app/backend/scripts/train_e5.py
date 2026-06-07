#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import warnings
from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
import numpy as np
from scipy.stats import ttest_rel
from sklearn.ensemble import GradientBoostingRegressor, StackingRegressor
from sklearn.linear_model import BayesianRidge, ElasticNet, Ridge
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor
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
OUT = REPO / 'data' / 'processed' / 'e5_outputs' / 'pipeline_final_e5.pkl'
META_OUT = REPO / 'data' / 'processed' / 'e5_outputs' / 'e5_artifacts_meta.json'
EXPERIMENT_NAME = os.getenv('MLFLOW_EXPERIMENT_NAME', 'metano-ml-e5-stacking')
MLFLOW_DIR = REPO / 'mlruns'

def scaled_pipeline(name: str, estimator):
    return Pipeline([('scaler', StandardScaler()), (name, estimator)])


def latency_p95_ms(model, X, repeats: int = 200) -> float:
    sample = X.head(1)
    timings = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        model.predict(sample)
        timings.append((time.perf_counter() - t0) * 1000.0)
    return float(np.percentile(timings, 95))


print(f'Cargando dataset raw desde {RAW_CSV}...')
df = load_raw_csv(RAW_CSV)
train_df, test_df = split_by_group(df, group_col='id_vaca', test_size=0.2, random_state=RANDOM_SEED)
_, X_train, y_train = build_xy_from_raw_df(train_df)
_, X_test, y_test = build_xy_from_raw_df(test_df)

base_models = {
    'ridge': scaled_pipeline('ridge', Ridge(alpha=1.0)),
    'mlp': scaled_pipeline(
        'mlp',
        MLPRegressor(
            hidden_layer_sizes=(256, 128, 64),
            activation='relu',
            solver='adam',
            alpha=0.001,
            batch_size=512,
            max_iter=300,
            early_stopping=True,
            n_iter_no_change=15,
            random_state=RANDOM_SEED,
            verbose=False,
        ),
    ),
    'bayesian_ridge': scaled_pipeline('bayesian_ridge', BayesianRidge()),
    'elasticnet': scaled_pipeline(
        'elasticnet',
        ElasticNet(alpha=0.01, l1_ratio=0.5, random_state=RANDOM_SEED, max_iter=5000),
    ),
    'knn': scaled_pipeline('knn', KNeighborsRegressor(n_neighbors=7)),
    'gbr': GradientBoostingRegressor(random_state=RANDOM_SEED),
}

scores = {}
test_predictions = {}
print('Entrenando modelos base E5...')
for name, model in base_models.items():
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    test_predictions[name] = pred
    scores[name] = {
        'rmse': float(np.sqrt(mean_squared_error(y_test, pred))),
        'r2': float(r2_score(y_test, pred)),
    }
    print(f'  - {name}: RMSE={scores[name]["rmse"]:.4f} R²={scores[name]["r2"]:.4f}')

stacking = StackingRegressor(
    estimators=[
        ('mlp', base_models['mlp']),
        ('bayesian_ridge', base_models['bayesian_ridge']),
        ('elasticnet', base_models['elasticnet']),
    ],
    final_estimator=Ridge(alpha=1.0),
    passthrough=False,
    cv=5,
    n_jobs=-1,
)

print('Entrenando Stacking final...')
stacking.fit(X_train, y_train)
pred_stack = stacking.predict(X_test)
rmse_stack = float(np.sqrt(mean_squared_error(y_test, pred_stack)))
r2_stack = float(r2_score(y_test, pred_stack))
scores['stacking'] = {'rmse': rmse_stack, 'r2': r2_stack}

rmse_e3_baseline = scores['ridge']['rmse']
rmse_e4_best = min(
    scores[name]['rmse']
    for name in ['mlp', 'bayesian_ridge', 'elasticnet', 'knn', 'gbr']
)
best_individual_name = min(
    ['mlp', 'bayesian_ridge', 'elasticnet', 'knn', 'gbr'],
    key=lambda name: scores[name]['rmse'],
)
best_individual_rmse = scores[best_individual_name]['rmse']

lift_vs_bl5_pct = round((rmse_e3_baseline - rmse_stack) / rmse_e3_baseline * 100, 2)
lift_vs_e4_pct = round((rmse_e4_best - rmse_stack) / rmse_e4_best * 100, 2)
pairwise_p = float(ttest_rel(np.abs(y_test - test_predictions['ridge']), np.abs(y_test - pred_stack)).pvalue)
ensemble_significant_lift = bool(pairwise_p < 0.05)
latency_ms = latency_p95_ms(stacking, X_test)

OUT.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(stacking, OUT)
print(f'✅ Pipeline final exportado → {OUT}')

meta = {
    'sklearn_version': __import__('sklearn').__version__,
    'numpy_version': __import__('numpy').__version__,
    'random_seed': RANDOM_SEED,
    'final_model': 'Stacking',
    'rmse_e5_final': rmse_stack,
    'r2_e5_final': r2_stack,
    'latency_p95_ms': latency_ms,
    'rmse_e3_baseline': rmse_e3_baseline,
    'rmse_e4_best': rmse_e4_best,
    'lift_vs_bl5_pct': lift_vs_bl5_pct,
    'lift_vs_e4_pct': lift_vs_e4_pct,
    'ensemble_significant_lift': ensemble_significant_lift,
    'feature_names': FEAT_REG,
    'n_features': len(FEAT_REG),
    'train_rows': int(len(train_df)),
    'test_rows': int(len(test_df)),
    'n_vacas_train': int(train_df['id_vaca'].nunique()),
    'n_vacas_test': int(test_df['id_vaca'].nunique()),
    'best_individual_model': best_individual_name,
    'best_individual_rmse': best_individual_rmse,
    'candidate_scores': scores,
    'ttest_pvalue_ridge_vs_stacking': pairwise_p,
}
META_OUT.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'✅ Metadata E5 exportada → {META_OUT}')

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
    with mlflow.start_run(run_name=os.getenv('MLFLOW_RUN_NAME', 'train_e5_stacking')):
        mlflow.set_tags(
            {
                'project': 'ml-nutraceuticos-ganado-lechero',
                'stage': 'E5',
                'model_family': 'StackingRegressor',
                'artifact_path': str(OUT.relative_to(REPO)),
            }
        )
        if git_commit:
            mlflow.set_tag('git_commit', git_commit)
        mlflow.log_params(
            {
                'random_seed': RANDOM_SEED,
                'cv': 5,
                'best_individual_model': best_individual_name,
                'base_models': ','.join(base_models.keys()),
            }
        )
        mlflow.log_metrics(
            {
                'rmse': rmse_stack,
                'r2': r2_stack,
                'rmse_e3_baseline': rmse_e3_baseline,
                'rmse_e4_best': rmse_e4_best,
                'lift_vs_bl5_pct': lift_vs_bl5_pct,
                'lift_vs_e4_pct': lift_vs_e4_pct,
                'latency_p95_ms': latency_ms,
                'ttest_pvalue_ridge_vs_stacking': pairwise_p,
            }
        )
        with TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            (tmp / 'candidate_scores.json').write_text(json.dumps(scores, indent=2, ensure_ascii=False), encoding='utf-8')
            (tmp / 'meta.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
            mlflow.log_artifact(str(tmp / 'candidate_scores.json'))
            mlflow.log_artifact(str(tmp / 'meta.json'))
        input_example = X_test.head(3)
        signature = infer_signature(X_train.head(3), pred_stack[:3])
        mlflow.sklearn.log_model(
            stacking,
            artifact_path='model',
            input_example=input_example,
            signature=signature,
        )
        mlflow.log_artifact(str(OUT), artifact_path='exports')
        print(f'✅ MLflow run logged in experiment: {EXPERIMENT_NAME}')
        print(f'   Tracking URI: {tracking_uri}')
else:
    print('⚠️  MLflow no está instalado; se omitió el tracking del experimento.')

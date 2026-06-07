from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


@dataclass(frozen=True)
class TrainResult:
    pipeline: Pipeline
    rmse: float
    r2: float
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    y_pred: np.ndarray


def build_mlp_pipeline(random_state: int = 42) -> Pipeline:
    return Pipeline(
        [
            ('scaler', StandardScaler()),
            (
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
                    random_state=random_state,
                    verbose=False,
                ),
            ),
        ]
    )


def train_test_pipeline(
    X: np.ndarray,
    y: np.ndarray,
    *,
    test_size: float = 0.2,
    random_state: int = 42,
) -> TrainResult:
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
    )

    pipeline = build_mlp_pipeline(random_state=random_state)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))

    return TrainResult(
        pipeline=pipeline,
        rmse=rmse,
        r2=r2,
        X_train=X_train,
        X_test=X_test,
        y_train=y_train,
        y_test=y_test,
        y_pred=y_pred,
    )

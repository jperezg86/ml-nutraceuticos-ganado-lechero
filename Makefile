PYTHON ?= python3

.PHONY: setup convert-raw app-install app-backend app-frontend app mlflow-ui train-log train-e3 train-e5 dvc-push dvc-pull

VENV_PY := .venv/bin/python

setup:
	@echo "Creando entorno base..."
	@test -d .venv || $(PYTHON) -m venv .venv
	@$(VENV_PY) -m pip install -U pip
	@$(VENV_PY) -m pip install -r app/requirements.txt
	@echo "Instalando dependencias del backend y frontend..."
	cd app/backend  && npm install
	cd app/frontend && npm install

convert-raw:
	PYTHONPATH=src $(PYTHON) -m ml_nutraceuticos_ganado_lechero.convert_raw_data

# ── Dashboard React + Node ────────────────────────────────────────────────────

app-install:
	@echo "Instalando dependencias..."
	cd app/backend  && npm install
	cd app/frontend && npm install

app-backend:
	@echo "Iniciando API (puerto 3001)..."
	cd app/backend && node server.js

app-frontend:
	@echo "Iniciando frontend React (puerto 3000)..."
	cd app/frontend && npm run dev

app:
	@echo "Iniciando Dashboard completo..."
	@echo "  API   → http://localhost:3001/api/health"
	@echo "  App   → http://localhost:3000"
	@(cd app/backend && node server.js &) && cd app/frontend && npm run dev

mlflow-ui:
	@echo "Iniciando MLflow UI..."
	$(VENV_PY) -m mlflow ui --backend-store-uri file://$(CURDIR)/mlruns

train-log:
	@echo "Entrenando el modelo y registrando el run en MLflow..."
	@test -x $(VENV_PY) || (echo "No existe .venv/bin/python. Ejecuta 'make setup' primero." && exit 1)
	@node -e "require('./app/backend/database.js'); console.log('SQLite inicializado')"
	@printf '%s' '{"repo_root":"$(CURDIR)","db_path":"$(CURDIR)/app/db/metano.db"}' | $(VENV_PY) app/backend/scripts/import_data.py
	@$(VENV_PY) app/backend/scripts/retrain_pipeline_raw.py

train-e3:
	@echo "Entrenando E3 y registrando el run en MLflow..."
	@test -x $(VENV_PY) || (echo "No existe .venv/bin/python. Ejecuta 'make setup' primero." && exit 1)
	@$(VENV_PY) app/backend/scripts/train_e3.py

train-e5:
	@echo "Entrenando E5 y registrando el run en MLflow..."
	@test -x $(VENV_PY) || (echo "No existe .venv/bin/python. Ejecuta 'make setup' primero." && exit 1)
	@$(VENV_PY) app/backend/scripts/train_e5.py

dvc-push:
	@echo "Subiendo artefactos DVC al remote de Google Drive..."
	dvc push

dvc-pull:
	@echo "Descargando artefactos DVC desde Google Drive..."
	dvc pull

PYTHON ?= python3

.PHONY: convert-raw app-install app-backend app-frontend app

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

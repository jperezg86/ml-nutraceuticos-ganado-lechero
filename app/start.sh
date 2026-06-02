#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_DIR/app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  🐄  Dashboard Metano Bovino — Equipo 48         ║"
echo "║      Tec de Monterrey — CRISP-ML(Q)              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Verificar Python ──────────────────────────────────────────
echo "🔍 Verificando dependencias Python..."
python3 -c "import joblib, numpy, pandas, scipy" 2>/dev/null || {
  echo "📦 Instalando dependencias Python..."
  pip3 install joblib numpy pandas scipy --quiet
}
echo "   ✓ Python OK"

# ── Instalar dependencias backend ─────────────────────────────
echo ""
echo "📦 Instalando dependencias backend (Node.js)..."
cd "$BACKEND_DIR"
npm install --silent
echo "   ✓ Backend OK"

# ── Instalar dependencias frontend ────────────────────────────
echo ""
echo "📦 Instalando dependencias frontend (React)..."
cd "$FRONTEND_DIR"
npm install --silent
echo "   ✓ Frontend OK"

# ── Iniciar servidores ─────────────────────────────────────────
echo ""
echo "🚀 Iniciando servidores..."
echo "   Backend  → http://localhost:3001"
echo "   Frontend → http://localhost:3000"
echo ""
echo "   Presiona Ctrl+C para detener ambos servidores"
echo ""

# Trap para matar ambos procesos al salir
trap 'echo ""; echo "⏹  Deteniendo servidores..."; kill $(jobs -p) 2>/dev/null; exit 0' SIGINT SIGTERM

# Iniciar backend
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

# Esperar un segundo para que el backend esté listo
sleep 1

# Iniciar frontend
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo "   Backend  PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "   🌐 Abriendo http://localhost:3000 en tu navegador..."
sleep 2

# Abrir en browser (funciona en macOS)
open "http://localhost:3000" 2>/dev/null || true

# Esperar a que alguno termine
wait

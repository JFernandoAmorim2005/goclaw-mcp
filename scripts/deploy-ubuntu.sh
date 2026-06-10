#!/usr/bin/env bash
# deploy-ubuntu.sh — Instala goclaw-mcp HTTP mode no jfa-server como serviço systemd
# Executar localmente: bash scripts/deploy-ubuntu.sh
# Ou transferir para o servidor: scp scripts/deploy-ubuntu.sh jfa@100.122.237.67:/tmp/ && ssh jfa@100.122.237.67 bash /tmp/deploy-ubuntu.sh

set -euo pipefail

REMOTE_USER="famorim"           # user no servidor (não jfa)
REMOTE_HOST="100.122.237.67"   # Tailscale IP do jfa-server
REMOTE_DIR="/opt/goclaw-mcp"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="goclaw-mcp"
PORT=3200  # 3100 ocupado pelo Grafana no Ubuntu

echo "==> GoClaw MCP — Deploy HTTP Mode"
echo "    Local:  $LOCAL_DIR"
echo "    Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR"
echo ""

# 1. Verificar Node.js no servidor
echo "[1/6] Verificar Node.js..."
NODE_VER=$(ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" \
  "node --version 2>/dev/null || echo 'NOT_FOUND'")

if [[ "$NODE_VER" == "NOT_FOUND" ]]; then
  echo "      Node.js não encontrado — a instalar via NodeSource..."
  ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" bash <<'INSTALL'
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
INSTALL
  NODE_VER=$(ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" "node --version")
fi
echo "      Node.js: $NODE_VER ✅"

# 2. Criar directório no servidor
echo "[2/6] Criar $REMOTE_DIR..."
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" \
  "sudo mkdir -p $REMOTE_DIR && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_DIR"

# 3. Copiar dist/ + package.json
echo "[3/6] Copiar ficheiros..."
# Garantir que dist/ está compilado
(cd "$LOCAL_DIR" && npm run build --silent)
scp -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 -r \
  "$LOCAL_DIR/dist" \
  "$LOCAL_DIR/package.json" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# 4. Instalar dependências de produção no servidor
echo "[4/6] npm install --omit=dev..."
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" \
  "cd $REMOTE_DIR && npm install --omit=dev --silent"

# 5. Criar .env no servidor (token vem de C:\goclaw\.env.local — copiar manualmente se necessário)
echo "[5/6] Criar .env..."
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" bash <<ENV
if [ ! -f "$REMOTE_DIR/.env" ]; then
  cat > "$REMOTE_DIR/.env" <<EOF
GOCLAW_SERVER=http://localhost:18790
GOCLAW_TOKEN=SUBSTITUIR_PELO_TOKEN
GOCLAW_MCP_PORT=$PORT
GOCLAW_LOG_LEVEL=info
EOF
  echo "      AVISO: editar $REMOTE_DIR/.env e preencher GOCLAW_TOKEN"
else
  echo "      .env já existe — mantido"
fi
ENV

# 6. Criar e activar serviço systemd
echo "[6/6] Serviço systemd $SERVICE_NAME..."
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 "$REMOTE_USER@$REMOTE_HOST" bash <<SYSTEMD
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=GoClaw MCP HTTP Server
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR
EnvironmentFile=$REMOTE_DIR/.env
ExecStart=/usr/bin/node $REMOTE_DIR/dist/http.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME
sleep 2
sudo systemctl status $SERVICE_NAME --no-pager
SYSTEMD

echo ""
echo "==> Deploy concluído! Verificar: curl http://$REMOTE_HOST:$PORT/health"

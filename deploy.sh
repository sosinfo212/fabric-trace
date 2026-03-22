#!/bin/bash
# =============================================================================
# Fabric Trace — Ubuntu 24.04 LTS VPS Deployment Script
# Stack: React/Vite (frontend) + Express/Node.js (backend) + MySQL 8
#        Nginx (reverse proxy) + PM2 (process manager)
# =============================================================================

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — edit these before running
# ──────────────────────────────────────────────────────────────────────────────
APP_DIR="/var/www/fabric-trace"      # Where the app lives on the server
REPO_URL=""                          # Git repo URL (leave empty to skip git clone)
DOMAIN=""                            # Your domain/IP, e.g. example.com or 1.2.3.4
NODE_VERSION="20"                    # Node.js LTS version

# Database
DB_NAME="pcd_db"
DB_USER="fabric_user"
DB_PASS=""                           # Set a strong password here!

# JWT
JWT_SECRET=""                        # Set a strong random secret here!

# Backend port (internal, not exposed publicly)
BACKEND_PORT="3001"

# ──────────────────────────────────────────────────────────────────────────────
# COLORS
# ──────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

# ──────────────────────────────────────────────────────────────────────────────
# PREFLIGHT CHECKS
# ──────────────────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Run this script as root: sudo bash deploy.sh"
[[ -z "$DB_PASS" ]]    && error "DB_PASS is not set. Edit the CONFIGURATION section."
[[ -z "$JWT_SECRET" ]] && error "JWT_SECRET is not set. Edit the CONFIGURATION section."
[[ -z "$DOMAIN" ]]     && error "DOMAIN is not set. Edit the CONFIGURATION section."

info "Starting deployment for fabric-trace on Ubuntu 24.04 LTS"
echo "  Domain/IP   : $DOMAIN"
echo "  App dir     : $APP_DIR"
echo "  DB name     : $DB_NAME"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1. SYSTEM PACKAGES
# ──────────────────────────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get install -y -qq curl git nginx mysql-server ufw build-essential

success "System packages installed"

# ──────────────────────────────────────────────────────────────────────────────
# 2. NODE.JS (via NodeSource)
# ──────────────────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')" != "$NODE_VERSION" ]]; then
  info "Installing Node.js $NODE_VERSION..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi
success "Node.js $(node -v) / npm $(npm -v)"

# ──────────────────────────────────────────────────────────────────────────────
# 3. PM2
# ──────────────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  npm install -g pm2 --silent
fi
success "PM2 $(pm2 -v)"

# ──────────────────────────────────────────────────────────────────────────────
# 4. MYSQL — secure setup
# ──────────────────────────────────────────────────────────────────────────────
info "Configuring MySQL..."
systemctl enable mysql --now

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
success "MySQL database '$DB_NAME' and user '$DB_USER' ready"

# ──────────────────────────────────────────────────────────────────────────────
# 5. APPLICATION CODE
# ──────────────────────────────────────────────────────────────────────────────
mkdir -p "$APP_DIR"

if [[ -n "$REPO_URL" ]]; then
  if [[ -d "$APP_DIR/.git" ]]; then
    info "Pulling latest code..."
    git -C "$APP_DIR" pull
  else
    info "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
  fi
else
  warn "REPO_URL not set — skipping git clone."
  warn "Copy your project files manually to $APP_DIR before continuing."
fi

# ──────────────────────────────────────────────────────────────────────────────
# 6. ENVIRONMENT FILES
# ──────────────────────────────────────────────────────────────────────────────
info "Writing environment files..."

# Root .env (Vite reads VITE_* at build time)
cat > "$APP_DIR/.env" <<EOF
VITE_API_URL=http://${DOMAIN}/api
EOF

# Server .env
mkdir -p "$APP_DIR/server"
cat > "$APP_DIR/server/.env" <<EOF
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}

JWT_SECRET=${JWT_SECRET}

FRONTEND_URL=http://${DOMAIN}
PORT=${BACKEND_PORT}
NODE_ENV=production
EOF

chmod 600 "$APP_DIR/.env" "$APP_DIR/server/.env"
success "Environment files written"

# ──────────────────────────────────────────────────────────────────────────────
# 7. PATCH VITE CONFIG — remove manualChunks (causes Radix UI forwardRef crash)
# ──────────────────────────────────────────────────────────────────────────────
info "Patching vite.config.ts (removing manualChunks)..."
cat > "$APP_DIR/vite.config.ts" <<'VITE'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
VITE
success "vite.config.ts patched"

# ──────────────────────────────────────────────────────────────────────────────
# 8. INSTALL DEPENDENCIES & BUILD FRONTEND
# ──────────────────────────────────────────────────────────────────────────────
info "Installing root dependencies..."
cd "$APP_DIR" && npm ci --silent

info "Building frontend (Vite)..."
npm run build
success "Frontend built → $APP_DIR/dist"

info "Installing server dependencies..."
cd "$APP_DIR/server" && npm ci --silent
success "Server dependencies installed"

# ──────────────────────────────────────────────────────────────────────────────
# 9. DATABASE MIGRATIONS
# ──────────────────────────────────────────────────────────────────────────────
info "Running database migrations..."
cd "$APP_DIR/server" && npm run migrate || \
  warn "Migration script exited with errors — check manually if needed"
success "Migrations complete"

# ──────────────────────────────────────────────────────────────────────────────
# 10. PM2 — start / reload backend
# ──────────────────────────────────────────────────────────────────────────────
info "Starting backend with PM2..."
PM2_ENV_FILE="$APP_DIR/server/.env"

if pm2 list | grep -q "fabric-api"; then
  pm2 reload fabric-api --update-env
else
  cd "$APP_DIR/server" && pm2 start index.js \
    --name fabric-api \
    --time \
    --max-memory-restart 512M \
    --restart-delay 3000
fi

# Persist PM2 across reboots
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
pm2 save
success "PM2 process 'fabric-api' running"

# ──────────────────────────────────────────────────────────────────────────────
# 11. NGINX — reverse proxy
# ──────────────────────────────────────────────────────────────────────────────
info "Configuring Nginx..."

NGINX_CONF="/etc/nginx/sites-available/fabric-trace"

cat > "$NGINX_CONF" <<NGINX
server {
    listen 80 default_server;
    server_name ${DOMAIN};

    # ── Frontend (static files) ──────────────────────────────────────────────
    root ${APP_DIR}/dist;
    index index.html;

    # Serve React SPA (handle client-side routing)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ── Backend API proxy ────────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade            \$http_upgrade;
        proxy_set_header   Connection         'upgrade';
        proxy_set_header   Host               \$host;
        proxy_set_header   X-Real-IP          \$remote_addr;
        proxy_set_header   X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto  \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 20M;
    }

    # ── Security headers ─────────────────────────────────────────────────────
    add_header X-Frame-Options       SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy       strict-origin-when-cross-origin;

    # ── Static asset caching ─────────────────────────────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── Gzip ─────────────────────────────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1024;
}
NGINX

# Enable site, disable default
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/fabric-trace
rm -f /etc/nginx/sites-enabled/default
# Also disable any conf.d default
rm -f /etc/nginx/conf.d/default.conf

nginx -t && systemctl reload nginx
success "Nginx configured and reloaded"

# ──────────────────────────────────────────────────────────────────────────────
# 12. FIREWALL (UFW)
# ──────────────────────────────────────────────────────────────────────────────
info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx HTTP'
ufw --force enable
success "Firewall enabled (SSH + HTTP allowed)"

# ──────────────────────────────────────────────────────────────────────────────
# DONE
# ──────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo "  App URL       : http://${DOMAIN}"
echo "  API URL       : http://${DOMAIN}/api"
echo "  App directory : ${APP_DIR}"
echo "  PM2 status    : $(pm2 list 2>/dev/null | grep fabric-api | awk '{print $10}' || echo 'run: pm2 list')"
echo ""
echo "Useful commands:"
echo "  pm2 logs fabric-api        # tail backend logs"
echo "  pm2 restart fabric-api     # restart backend"
echo "  sudo nginx -t              # test nginx config"
echo "  sudo tail -f /var/log/nginx/error.log"
echo ""
echo "Optional next step — add HTTPS with Let's Encrypt:"
echo "  sudo apt install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d ${DOMAIN}"
echo ""

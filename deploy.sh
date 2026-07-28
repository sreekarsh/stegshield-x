#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# StegShield X — Production Deploy Script
# Usage: bash deploy.sh <your-domain.com>
# Example: bash deploy.sh stegshield.com
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  err "Usage: bash deploy.sh <your-domain.com>"
  exit 1
fi

# ─── Pre-flight checks ───────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker       >/dev/null 2>&1 || { err "Docker not found";          exit 1; }
command -v docker       >/dev/null 2>&1 && ok "docker       $(docker --version)"
docker compose version  >/dev/null 2>&1 || { err "docker compose not found";   exit 1; }
docker compose version  >/dev/null 2>&1 && ok "compose      $(docker compose version --short)"

if [ ! -f docker-compose.yml ]; then err "Run this script from the project root (where docker-compose.yml lives)"; exit 1; fi
if [ ! -f backend/.env ];           then err "backend/.env missing";            exit 1; fi
if [ ! -f frontend/.env.local ];    then warn "frontend/.env.local missing — will create from example"; fi

# ─── 1. Pull latest code ──────────────────────────────────────────────────────
info "Pulling latest code..."
git fetch origin 2>/dev/null || warn "Not a git repo or no remote — skipping fetch"
git pull 2>/dev/null          || true

# ─── 2. Configure backend .env ────────────────────────────────────────────────
info "Configuring backend .env for production..."

BACKEND_ENV="backend/.env"

# Update or append APP_URL
if grep -q "^APP_URL=" "$BACKEND_ENV"; then
  sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" "$BACKEND_ENV"
else
  echo "APP_URL=https://$DOMAIN" >> "$BACKEND_ENV"
fi

# Update or append CORS_ORIGIN
if grep -q "^CORS_ORIGIN=" "$BACKEND_ENV"; then
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" "$BACKEND_ENV"
else
  echo "CORS_ORIGIN=https://$DOMAIN" >> "$BACKEND_ENV"
fi

# Ensure NODE_ENV=production
if grep -q "^NODE_ENV=" "$BACKEND_ENV"; then
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$BACKEND_ENV"
else
  echo "NODE_ENV=production" >> "$BACKEND_ENV"
fi

# Update OAuth callback URLs
sed -i "s|http://localhost:4000/api/auth/google|https://$DOMAIN/api/auth/google|g" "$BACKEND_ENV"
sed -i "s|http://localhost:4000/api/auth/github|https://$DOMAIN/api/auth/github|g" "$BACKEND_ENV"
sed -i "s|http://localhost:3000/auth/callback|https://$DOMAIN/auth/callback|g" "$BACKEND_ENV"

# Update SMTP APP_URL
sed -i "s|APP_URL=http://localhost:3000|APP_URL=https://$DOMAIN|" "$BACKEND_ENV"

# Public sharing — not IP restricted
if grep -q "^SHARING_DEFAULT_IP_RESTRICTED=" "$BACKEND_ENV"; then
  sed -i "s/^SHARING_DEFAULT_IP_RESTRICTED=.*/SHARING_DEFAULT_IP_RESTRICTED=false/" "$BACKEND_ENV"
else
  echo "SHARING_DEFAULT_IP_RESTRICTED=false" >> "$BACKEND_ENV"
fi

ok "backend/.env configured"

# ─── 3. Configure frontend .env.local ─────────────────────────────────────────
info "Configuring frontend .env.local for production..."

FRONTEND_ENV="frontend/.env.local"

cat > "$FRONTEND_ENV" <<EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NEXT_PUBLIC_SHARING_DEFAULT_IP_RESTRICTED=false
EOF

ok "frontend/.env.local configured"

# ─── 4. Update nginx.conf ─────────────────────────────────────────────────────
info "Updating nginx server_name to $DOMAIN..."

NGINX_CONF="docker/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
  sed -i "s/server_name [^;]*;/server_name $DOMAIN www.$DOMAIN;/g" "$NGINX_CONF"
  ok "nginx.conf updated"
else
  warn "nginx.conf not found at $NGINX_CONF"
fi

# ─── 5. SSL certificates (Let's Encrypt) ──────────────────────────────────────
info "Setting up SSL certificates for $DOMAIN..."

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
DOCKER_CERT_DIR="docker/certs"

if [ -d "$CERT_DIR" ]; then
  info "Let's Encrypt certs already exist at $CERT_DIR"
else
  warn "No Let's Encrypt certs found."
  echo -e "  ${YELLOW}You have two options:${NC}"
  echo ""
  echo "  Option A — Auto (port 80 must be free):"
  echo "    docker compose down nginx  # stop nginx temporarily"
  echo "    apt install -y certbot"
  echo "    certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
  echo ""
  echo "  Option B — Manual (DNS challenge):"
  echo "    certbot certonly --manual --preferred-challenges dns -d $DOMAIN -d www.$DOMAIN"
  echo ""
  read -rp "Run certbot now? (y/N): " RUN_CERTBOT
  if [[ "$RUN_CERTBOT" =~ ^[Yy]$ ]]; then
    docker compose down nginx 2>/dev/null || true
    apt install -y certbot
    certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN"
  fi
fi

# Copy certs to docker cert dir if they exist
if [ -d "$CERT_DIR" ]; then
  mkdir -p "$DOCKER_CERT_DIR"
  cp "$CERT_DIR/fullchain.pem" "$DOCKER_CERT_DIR/$DOMAIN.crt"
  cp "$CERT_DIR/privkey.pem"   "$DOCKER_CERT_DIR/$DOMAIN.key"
  ok "SSL certs copied to $DOCKER_CERT_DIR"
fi

# ─── 6. Generate fresh secrets ────────────────────────────────────────────────
info "Generating fresh secrets..."
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_SECRET=$(openssl rand -hex 32)
RESET_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -hex 64)
AI_API_KEY=$(openssl rand -hex 32)

sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$BACKEND_ENV"
sed -i "s/^REFRESH_TOKEN_SECRET=.*/REFRESH_TOKEN_SECRET=$REFRESH_SECRET/" "$BACKEND_ENV"
sed -i "s/^RESET_TOKEN_SECRET=.*/RESET_TOKEN_SECRET=$RESET_SECRET/" "$BACKEND_ENV"
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" "$BACKEND_ENV"
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" "$BACKEND_ENV"
sed -i "s/^AI_API_KEY=.*/AI_API_KEY=$AI_API_KEY/" "$BACKEND_ENV"

ok "Fresh secrets generated"

# ─── 7. Prisma migrate ───────────────────────────────────────────────────────
info "Running Prisma migrations..."
docker compose run --rm backend npx prisma migrate deploy 2>/dev/null && \
  ok "Prisma migrations applied" || \
  warn "Prisma migrate failed — you may need to run it manually after first deploy"

# ─── 8. Build & deploy ────────────────────────────────────────────────────────
info "Building and deploying all services..."
docker compose up -d --build

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  StegShield X deployed successfully!${NC}"
echo -e "${GREEN}  https://$DOMAIN${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo "  1. Configure OAuth credentials in backend/.env"
echo "  2. Configure SMTP in backend/.env for email features"
echo "  3. Monitor logs:  docker compose logs -f"
echo ""

# ─── 9. Health check ─────────────────────────────────────────────────────────
info "Running health check..."
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
case "$HTTP_CODE" in
  200|301|302) ok "Site is live — HTTP $HTTP_CODE" ;;
  *)           warn "Health check returned HTTP $HTTP_CODE — check logs: docker compose logs -f" ;;
esac

#!/bin/bash
# ==============================================================================
# StegShield X — Production Domain & SSL Setup Script
# Works with DuckDNS, custom domains, and any Linux VPS (Ubuntu/Debian/RHEL)
# ==============================================================================

set -e

echo "======================================================================"
echo "           StegShield X — Production Domain & SSL Setup              "
echo "======================================================================"
echo ""

# Prompt for domain and email if not provided as arguments
DOMAIN=${1:-""}
EMAIL=${2:-""}

if [ -z "$DOMAIN" ]; then
    read -p "Enter your Domain / DuckDNS hostname (e.g. secureshare.duckdns.org): " DOMAIN
fi

if [ -z "$EMAIL" ]; then
    read -p "Enter your Email for Let's Encrypt SSL alerts: " EMAIL
fi

if [ -z "$DOMAIN" ]; then
    echo "❌ Error: Domain name is required."
    exit 1
fi

# Clean up domain format
DOMAIN=$(echo "$DOMAIN" | sed -e 's|^https://||' -e 's|^http://||' -e 's|/*$||')
APP_URL="https://$DOMAIN"
API_URL="https://$DOMAIN/api"

echo ""
echo "📌 Target Domain: $DOMAIN"
echo "🔗 Application URL: $APP_URL"
echo "🌐 API Endpoint: $API_URL"
echo ""

# Generate Backend Environment Configuration
echo "⚙️ Creating backend/.env for production..."
mkdir -p backend
cat <<EOF > backend/.env
NODE_ENV=production
PORT=4000
APP_URL=$APP_URL
CORS_ORIGIN=$APP_URL
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/stegshield?schema=public
REDIS_URL=redis://redis:6379
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "stegshield-prod-jwt-secret-$(date +%s)")
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "stegshield-prod-refresh-secret-$(date +%s)")
ENCRYPTION_KEY=$(openssl rand -base64 32 2>/dev/null || echo "stegshield-prod-enc-key-32bytes==")
SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "stegshield-prod-secret-key")
AI_SERVICE_URL=http://ai-service:8000
AI_API_KEY_REQUIRED=true

# Secure Sharing Production Settings
SHARING_DEFAULT_IP_RESTRICTED=false
SHARING_DEFAULT_MAX_DOWNLOADS=10
SHARING_DEFAULT_EXPIRY=24h
SHARING_REQUIRE_PASSWORD=true
EOF

# Generate Frontend Environment Configuration
echo "⚙️ Creating frontend/.env.local for production..."
mkdir -p frontend
cat <<EOF > frontend/.env.local
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_SHARING_DEFAULT_IP_RESTRICTED=false
NEXT_PUBLIC_SHARING_DEFAULT_MAX_DOWNLOADS=10
NEXT_PUBLIC_SHARING_DEFAULT_EXPIRY=24h
NEXT_PUBLIC_SHARING_REQUIRE_PASSWORD=true
EOF

echo "✅ Environment files created successfully."

# SSL Certificate Setup
echo ""
echo "🔒 Checking SSL Certificates for $DOMAIN..."

CERT_DIR="./stegshield_certs"
mkdir -p "$CERT_DIR"

if command -v certbot &> /dev/null; then
    echo "Installing Let's Encrypt SSL certificate using Certbot..."
    sudo certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" || echo "⚠️ Certbot standalone request failed; falling back to self-signed cert..."
    
    LE_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    LE_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    
    if [ -f "$LE_CERT" ] && [ -f "$LE_KEY" ]; then
        echo "Copying Let's Encrypt certificates to Docker volume path..."
        cp "$LE_CERT" "$CERT_DIR/stegshield.crt"
        cp "$LE_KEY" "$CERT_DIR/stegshield.key"
        echo "✅ Real Let's Encrypt SSL certificate applied!"
    fi
else
    echo "💡 Certbot not installed on host. Docker Nginx will generate an SSL certificate automatically on boot."
fi

# Launch Docker Compose Stack
echo ""
echo "🚀 Building and starting StegShield X containers..."
docker compose down || true
docker compose up -d --build

echo ""
echo "======================================================================"
echo "🎉 StegShield X is now live and configured!"
echo "🌐 Access your app at: $APP_URL"
echo "🔒 Secure Share Link base: $APP_URL/share/<code_id>"
echo "======================================================================"

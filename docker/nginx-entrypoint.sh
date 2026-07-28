#!/bin/sh
set -e

CERT_DIR=/etc/ssl/stegshield
CERT_FILE=$CERT_DIR/stegshield.crt
KEY_FILE=$CERT_DIR/stegshield.key

# Auto-generate self-signed cert on first run (dev/CI only)
# Production: mount real CA-signed certs at these paths
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[ENTRYPOINT] Generating self-signed SSL certificate for development..."
    mkdir -p $CERT_DIR
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout $KEY_FILE \
        -out $CERT_FILE \
        -subj "/C=US/ST=State/L=City/O=StegShield/CN=stegshield.ai" 2>/dev/null
    echo "[ENTRYPOINT] Self-signed cert generated at $CERT_DIR"
fi

echo "[ENTRYPOINT] Starting nginx..."
exec nginx -g "daemon off;"

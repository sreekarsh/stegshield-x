#!/bin/sh
# Generate self-signed SSL certs for dev/CI testing
# Production: use real CA-signed certs from Let's Encrypt, etc.
mkdir -p /etc/ssl/certs /etc/ssl/private
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/stegshield.key \
  -out /etc/ssl/certs/stegshield.crt \
  -subj "/C=US/ST=State/L=City/O=StegShield/CN=stegshield.ai" 2>/dev/null

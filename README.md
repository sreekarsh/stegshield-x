# 🛡️ StegShield X — AI-Powered Zero-Trust Security & Forensics Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2010-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![FastAPI](https://img.shields.io/badge/AI_Service-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

**StegShield X** is an enterprise-grade cybersecurity, digital forensics, steganography, and zero-trust security platform. Built with Next.js 16 (App Router), NestJS 10, Python FastAPI, PostgreSQL, and Redis, it delivers robust cryptographic tools, AI threat detection, encrypted messaging, and emergency incident response mechanisms.

---

## 🌟 Key Features

### 🔐 Cryptography & Privacy Tools
- **Image & File Encryption:** Client-side and server-side AES-256-GCM encryption for files, images, and documents.
- **Time Capsules:** Time-locked data encryption using PBKDF2 SHA-256 and AES-256-GCM that strictly cannot be unlocked before a designated future date.
- **Shamir Secret Sharing:** Split master keys and secrets into multiple shares ($N$-of-$M$ threshold cryptography).
- **Decoy Vaults:** Dual-passphrase vaults that render fake decoy data under coerced access scenarios.
- **Secret Languages:** Custom glyph and symbol-based cipher language translation & text obfuscation.
- **PDF Protect & Unlock:** Encrypt and decrypt PDF documents with custom passwords.

### 🔍 Digital Forensics & AI Analysis
- **Steganography Engine:** LSB spatial and append steganography encoding and decoding in images and audio files.
- **LSB & Entropy Forensics:** Comprehensive Shannon entropy analysis, byte distribution profiling, and file carving.
- **Tamper Detection & ELA:** Error Level Analysis (ELA) and gradient consistency checks to detect photo manipulations.
- **Deepfake & Threat Analysis:** Frequency spectrum analysis (FFT) and color correlation checks to detect synthetic/manipulated media.
- **Trust Scoring:** Multi-factor security grading engine (ratings from **A+** down to **F**).

### 💬 Encrypted Chat & Contact Discovery
- **Secure Chat:** AES-256 end-to-end encrypted messaging with self-destruct timers and one-time view media.
- **User Discovery & Requests:** Discover registered security operatives by name or email and send contact connection requests.

### 👥 Team Management & 5-Role RBAC
- **5-Role Access Control:** Granular permission system supporting **`OWNER`**, **`ADMIN`**, **`EDITOR`**, **`INVESTIGATOR`**, and **`VIEWER`**.
- **Team Workspace:** Organization management, invitation links, activity monitoring, and member audit tracking.

### 🚨 Emergency Response & Support
- **Panic Mode:** One-click emergency account lockdown, key destruction, multi-device session revocation, and audit wipe protection.
- **Emergency Alerting:** Instant security incident reporting dispatched directly to admin security email (`sreekarsh44@gmail.com`).

---

## 🏗️ Architecture Stack

```
cybersecurity/
├── frontend/          # Next.js 16 App Router + React 18 + Tailwind CSS + shadcn/ui
├── backend/           # NestJS 10 + Prisma ORM + PostgreSQL 16 + Argon2 + JWT
├── ai-service/        # Python FastAPI + NumPy + Pillow + SciPy (AI Forensics Engine)
├── docker/            # Dockerfiles & Nginx Reverse Proxy Configuration
└── docker-compose.yml # Full-stack orchestration (5 microservices)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js `v18+` or `v20+`
- Python `3.10+`
- PostgreSQL `16+`
- Redis `7+`

### 1. Clone Repository
```bash
git clone https://github.com/sreekarsh/stegshield-x.git
cd stegshield-x
```

### 2. Backend Setup (NestJS API)
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
# API will run at http://localhost:4000/api
```

### 3. AI Microservice Setup (FastAPI)
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# AI Service will run at http://localhost:8000
```

### 4. Frontend Setup (Next.js 16)
```bash
cd frontend
npm install
npm run dev
# Web application will open at http://localhost:3000
```

---

## 🐳 Docker Deployment

To launch the full 5-service stack locally or on a VPS:

```bash
docker compose up -d --build
```

Services exposed:
- **Nginx Proxy:** `http://localhost:80` (or HTTPS port `443`)
- **Frontend App:** `http://localhost:3000`
- **Backend API:** `http://localhost:4000/api`
- **AI Microservice:** `http://localhost:8000`

---

## 🧪 Testing & Verification

Run unit test suites across modules:

```bash
# Backend Test Suite (33 Test Suites / 325 Tests)
cd backend
npx jest

# Frontend Typecheck
cd frontend
npm run typecheck
```

---

## 🛡️ License & Author

Created & Maintained by **Sree Karsh**.  
Developed for advanced zero-trust cybersecurity, digital forensics, and cryptographic research.

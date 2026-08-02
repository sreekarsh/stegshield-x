# 🌐 StegShield X — 100% Free Vercel + Render Deployment Guide

Follow this simple 2-part guide to deploy your entire StegShield X full-stack project to the cloud for **FREE** with automatic HTTPS domains!

---

## ⚠️ CRITICAL: Fix Google OAuth Before Deploying

**You must do this FIRST or Google Auth will fail with "Authentication Failed":**

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, **REMOVE** `http://localhost:4000/api/auth/google/callback`
4. **ADD** your Render backend URL: `https://stegshield-backend.onrender.com/api/auth/google/callback`
5. Click **Save**

---

## 🎯 Part 1: Deploy Backend & Database on Render (5 Minutes)

1. Go to **[Render.com](https://render.com)** and log in with your GitHub account.
2. Click **New +** → **Blueprint**.
3. Connect your **`cybersecurity`** repository.
4. Render will automatically detect the [`render.yaml`](file:///c:/Users/admin/Desktop/cybersecurity/render.yaml) file in your repository!
5. Click **Apply**.
6. Render will automatically create:
   * 🐘 **`stegshield-db`** (Free PostgreSQL Database)
   * ⚙️ **`stegshield-backend`** (NestJS Backend Service)
   * 🤖 **`stegshield-ai-service`** (Python FastAPI AI Service)
7. Once deployed, copy your backend URL from Render (e.g. `https://stegshield-backend.onrender.com`).

### 🔧 Backend Environment Variables (Set in Render Dashboard)

After deploying, go to **stegshield-backend → Environment** in Render and add/update these variables:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `https://stegshield-backend.onrender.com/api/auth/google/callback` |
| `GITHUB_CLIENT_ID` | Your GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | Your GitHub OAuth Client Secret |
| `GITHUB_CALLBACK_URL` | `https://stegshield-backend.onrender.com/api/auth/github/callback` |
| `OAUTH_SUCCESS_URL` | `https://stegshield-x.vercel.app/auth/callback` |
| `CORS_ORIGIN` | `https://stegshield-x.vercel.app` |
| `APP_URL` | `https://stegshield-x.vercel.app` |
| `COOKIE_DOMAIN` | `.vercel.app` |

> **Note:** Replace `stegshield-x.vercel.app` with your actual Vercel domain if different.

---

## 🎨 Part 2: Deploy Frontend on Vercel (2 Minutes)

1. Go to **[Vercel.com](https://vercel.com)** and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Select your **`cybersecurity`** repository.
4. Set **Root Directory** to `frontend`.
5. Under **Environment Variables**, add:
   * **Name**: `NEXT_PUBLIC_API_URL`
   * **Value**: `https://stegshield-backend.onrender.com/api` (your Render backend URL + `/api`)
   * **Name**: `NEXT_PUBLIC_APP_URL`
   * **Value**: `https://stegshield-x.vercel.app` (your Vercel frontend URL)
6. Click **Deploy**!

---

## 🔄 Final Step: Connect Frontend & Backend

Once your Vercel frontend URL is live (e.g., `https://stegshield-x.vercel.app`):
1. Go back to **Render.com** → `stegshield-backend` → **Environment**.
2. Set `APP_URL` = `https://stegshield-x.vercel.app`
3. Set `CORS_ORIGIN` = `https://stegshield-x.vercel.app`
4. Click **Save Changes**.

---

### 🎉 Congratulations!
Your project is live!
* **Frontend**: `https://stegshield-x.vercel.app` (Free HTTPS Domain)
* **Backend**: `https://stegshield-backend.onrender.com/api`
* **Secure Sharing**: Links created will automatically use your Vercel URL!

# 🌐 StegShield X — 100% Free Vercel + Render Deployment Guide

Follow this simple 2-part guide to deploy your entire StegShield X full-stack project to the cloud for **FREE** with automatic HTTPS domains!

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
   * **Value**: `https://your-app.vercel.app` (your Vercel frontend URL)
6. Click **Deploy**!

---

## 🔄 Final Step: Connect Frontend & Backend

Once your Vercel frontend URL is live (e.g., `https://stegshield.vercel.app`):
1. Go back to **Render.com** -> `stegshield-backend` -> **Environment**.
2. Set `APP_URL` = `https://stegshield.vercel.app`
3. Set `CORS_ORIGIN` = `https://stegshield.vercel.app`
4. Click **Save Changes**.

---

### 🎉 Congratulations!
Your project is live!
* **Frontend**: `https://stegshield.vercel.app` (Free HTTPS Domain)
* **Backend**: `https://stegshield-backend.onrender.com/api`
* **Secure Sharing**: Links created will automatically use your Vercel URL!

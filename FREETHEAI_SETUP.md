# FreeTheAi + Opencode Setup

## 1. Get API Key
- Join Discord: https://discord.gg/secrets
- Run `/signup` then `/checkin` (daily)
- Copy your `sta_...` key

## 2. Configure Opencode
Edit `C:\Users\admin\.config\opencode\opencode.json`:

```json
{
  "provider": {
    "freetheai": {
      "name": "FreeTheAi",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://api.freetheai.xyz/v1",
        "apiKey": "sta_YOUR_KEY_HERE"
      },
      "models": {
        "glm/glm-5.2": { "name": "GLM 5.2" },
        "opc/deepseek-v4-flash-free": { "name": "DeepSeek V4 Flash" },
        "bbl/gemini-3.5-flash": { "name": "Gemini 3.5 Flash" }
      }
    }
  },
  "model": "freetheai/glm/glm-5.2"
}
```

## 3. Run
```
cd your-project
opencode
```

## 4. Daily Check-in
Run `/checkin` in FreeTheAi Discord each day to unlock key.

## For Claude (Kiro CLI)
```
kiro-cli chat "question" --model claude-sonnet-4.5 --no-interactive
```
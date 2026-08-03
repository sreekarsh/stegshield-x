import asyncio
import functools
import httpx
import logging
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import numpy as np
from PIL import Image
import io
import json
import hashlib
import base64
import os
import hmac
from dotenv import load_dotenv
from typing import Optional

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s (%(threadName)s): %(message)s"
)
logger = logging.getLogger("stegshield-ai")

async def _run_cpu(func, *args, **kwargs):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, functools.partial(func, *args, **kwargs))

load_dotenv()

GITHUB_API_KEY = os.getenv("GITHUB_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
GITHUB_API_BASE = "https://models.inference.ai.azure.com"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4000").split(",")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "50000000"))  # 50MB max file limit
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "64000000")) # 8000x8000 max pixels
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

AI_API_KEY = os.getenv("AI_API_KEY", "stegshield-ai-key-change-in-production").strip("\"' ")
# Default to TRUE for security unless explicitly set to false/0/no
env_req = os.getenv("AI_API_KEY_REQUIRED", "true").lower().strip()
AI_API_KEY_REQUIRED = env_req not in ("0", "false", "no", "off")

security = HTTPBearer(auto_error=False)

async def verify_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not AI_API_KEY_REQUIRED:
        return True
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if AI_API_KEY and not hmac.compare_digest(credentials.credentials, AI_API_KEY):
        logger.warning("Invalid API key attempt")
        raise HTTPException(status_code=403, detail="Invalid API key")
    return True

is_production = os.getenv("NODE_ENV", "development") == "production"

app = FastAPI(
    title="StegShield X AI Service",
    description="AI-powered security analysis, steganalysis, tamper detection, and threat scoring",
    version="1.0.0",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

@app.middleware("http")
async def request_tracing_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    logger.info(f"[{request_id}] {request.method} {request.url.path}")
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

async def validate_file_size(file: UploadFile):
    content_length = file.size or 0
    if content_length > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE/1e6:.0f}MB")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {MAX_FILE_SIZE/1e6:.0f}MB")
    return contents

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "stegshield-ai", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"status": "healthy", "service": "stegshield-ai", "version": "1.0.0"}

from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatBody(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None

SYSTEM_PROMPT = """You are StegShield X AI Security Assistant, an elite Cybersecurity & Digital Forensics AI Specialist.
You specialize in:
1. Steganography Detection & Payload Extraction (LSB, DCT, F5, OutGuess, Palette analysis).
2. Digital Forensics & File Carving (Entropy analysis, string extraction, EXIF metadata privacy).
3. Image Tamper & Deepfake Detection (ELA, Frequency domain FFT analysis, copy-move detection).
4. Password Security & Cryptography (Argon2id, AES-256-GCM, Shamir Secret Sharing, RSA).
5. Threat Intelligence & Secure Communications.

Provide clear, highly professional, precise, and actionable security advice formatted with clean markdown, bolding, and bullet points."""

def get_ai_config():
    """Detects active AI provider and key from environment variables."""
    load_dotenv(override=True)
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    github_key = os.getenv("GITHUB_API_KEY", "").strip()
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

    if groq_key:
        return {
            "key": groq_key,
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "model": os.getenv("AI_MODEL", "llama-3.3-70b-versatile"),
            "provider": "Groq AI"
        }
    elif gemini_key:
        return {
            "key": gemini_key,
            "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "model": os.getenv("AI_MODEL", "gemini-1.5-flash"),
            "provider": "Google Gemini"
        }
    elif openai_key:
        return {
            "key": openai_key,
            "url": "https://api.openai.com/v1/chat/completions",
            "model": os.getenv("AI_MODEL", "gpt-4o-mini"),
            "provider": "OpenAI"
        }
    elif github_key:
        return {
            "key": github_key,
            "url": "https://models.inference.ai.azure.com/chat/completions",
            "model": os.getenv("AI_MODEL", "gpt-4o-mini"),
            "provider": "GitHub Models"
        }
    elif deepseek_key:
        return {
            "key": deepseek_key,
            "url": "https://api.deepseek.com/chat/completions",
            "model": os.getenv("AI_MODEL", "deepseek-chat"),
            "provider": "DeepSeek"
        }
    return None

@app.post("/chat/stream")
async def chat_stream(body: ChatBody, auth=Depends(verify_auth)):
    """Streaming chat completion (SSE event stream)."""
    config = get_ai_config()
    if not config:
        async def offline_generator():
            msg = "🔒 **StegShield X AI (Offline Mode)**\n\nNo AI API key is currently configured. To enable live AI responses, add one of the following keys to your `ai-service/.env` file:\n\n• **Groq API Key** (`GROQ_API_KEY`) — *Free & Ultra Fast (Recommended)*\n• **Google Gemini Key** (`GEMINI_API_KEY`) — *Free Tier available*\n• **OpenAI API Key** (`OPENAI_API_KEY`) — *gpt-4o / gpt-4o-mini*\n• **GitHub Models Key** (`GITHUB_API_KEY`) — *Free for GitHub accounts*\n• **DeepSeek Key** (`DEEPSEEK_API_KEY`) — *DeepSeek R1 / Chat*\n\nRestart `ai-service` after setting your key."
            yield f"data: {json.dumps({'content': msg})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(offline_generator(), media_type="text/event-stream")

    async def stream_generator():
        payload = {
            "model": config["model"],
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + [
                {"role": m.role, "content": m.content} for m in body.messages
            ],
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 1024,
        }
        headers = {
            "Authorization": f"Bearer {config['key']}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", config["url"], json=payload, headers=headers) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                yield "data: [DONE]\n\n"
                                break
                            try:
                                parsed = json.loads(data_str)
                                delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    yield f"data: {json.dumps({'content': delta})}\n\n"
                            except Exception:
                                pass
        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            provider_name = config["provider"]
            err_msg = f"*(AI Service Error ({provider_name}): {str(e)})*"
            yield f"data: {json.dumps({'content': err_msg})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@app.post("/chat/complete")
async def chat_complete(body: ChatBody, auth=Depends(verify_auth)):
    """Non-streaming chat completion (collects full response)."""
    config = get_ai_config()
    if not config:
        return {"content": "🔒 AI service running in offline mode — no API key configured in ai-service/.env."}

    payload = {
        "model": config["model"],
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + [
            {"role": m.role, "content": m.content} for m in body.messages
        ],
        "stream": False,
        "temperature": 0.7,
        "max_tokens": 1024,
    }
    headers = {
        "Authorization": f"Bearer {config['key']}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                config["url"],
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return {"content": content}
    except Exception as e:
        logger.error(f"Chat completion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI service chat completion failed: {str(e)}")

def _analyze_entropy_sync(contents: bytes, filename: str):
    data = np.frombuffer(contents, dtype=np.uint8)
    if len(data) == 0:
        return {"error": "Empty file"}
    hist, _ = np.histogram(data, bins=256, range=(0, 256))
    hist = hist / hist.sum() if hist.sum() > 0 else hist
    entropy = float(-np.sum(hist * np.log2(hist + 1e-10)))

    segments = min(16, len(data) // 256)
    segment_entropies = []
    if segments > 0:
        seg_size = len(data) // segments
        for i in range(segments):
            seg = data[i * seg_size : (i + 1) * seg_size]
            if len(seg) > 10:
                seg_hist, _ = np.histogram(seg, bins=256, range=(0, 256))
                seg_hist = seg_hist / seg_hist.sum() if seg_hist.sum() > 0 else seg_hist
                seg_entropy = float(-np.sum(seg_hist * np.log2(seg_hist + 1e-10)))
                segment_entropies.append(seg_entropy)

    max_seg_entropy = max(segment_entropies) if segment_entropies else entropy
    avg_seg_entropy = float(np.mean(segment_entropies)) if segment_entropies else entropy
    seg_std = float(np.std(segment_entropies)) if len(segment_entropies) > 1 else 0.0
    suspicious = max_seg_entropy > 7.5 or (seg_std > 0.5 and avg_seg_entropy > 6.0)

    return {
        "filename": filename,
        "size": len(contents),
        "entropy": round(entropy, 4),
        "max_entropy": 8.0,
        "entropy_ratio": round(entropy / 8.0, 4),
        "suspicious": suspicious,
        "segmented_analysis": {
            "segments": segments,
            "avg_segment_entropy": round(avg_seg_entropy, 4),
            "max_segment_entropy": round(max_seg_entropy, 4),
            "segment_std_dev": round(seg_std, 4),
            "high_entropy_segments": sum(1 for e in segment_entropies if e > 7.5),
        } if segments > 0 else None,
    }

@app.post("/analyze/entropy")
async def analyze_entropy(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    return await _run_cpu(_analyze_entropy_sync, contents, file.filename)

def _analyze_stego_sync(contents: bytes, filename: str):
    fmt = detect_file_format(contents)
    image_like_formats = {"png", "jpeg", "bmp", "gif", "tiff", "webp", "riff"}

    if fmt is None or fmt not in image_like_formats:
        return {
            "filename": filename,
            "lsb_ratio": 0.5, "lsb_deviation": 0.0, "segment_cv": 0.0, "stego_probability": 0.0,
            "recommended_action": "LSB analysis is only meaningful for image/audio files",
            "skipped": True,
        }

    data = np.frombuffer(contents, dtype=np.uint8)
    lsb_ones = int(np.sum(data & 1))
    total_bits = len(data)
    lsb_ratio = float(lsb_ones / total_bits) if total_bits > 0 else 0.5
    lsb_deviation = abs(lsb_ratio - 0.5)

    segments = 16
    seg_size = max(1, len(data) // segments)
    segment_deviations = []
    for i in range(segments):
        seg = data[i * seg_size : (i + 1) * seg_size]
        if len(seg) > 100:
            ones = int(np.sum(seg & 1))
            ratio = ones / len(seg)
            segment_deviations.append(abs(ratio - 0.5))

    seg_cv = float(np.std(segment_deviations) / (np.mean(segment_deviations) + 1e-10)) if len(segment_deviations) > 1 else 0.0

    if lsb_deviation > 0.05 and seg_cv > 0.3:
        stego_probability = min(0.9, 0.4 + lsb_deviation * 8 + seg_cv * 0.5)
    elif lsb_deviation > 0.03:
        stego_probability = min(0.6, 0.15 + lsb_deviation * 10)
    elif seg_cv > 0.5:
        stego_probability = 0.4
    else:
        stego_probability = 0.05
    stego_probability = float(min(max(stego_probability, 0.0), 1.0))

    return {
        "filename": filename,
        "lsb_ratio": round(lsb_ratio, 4),
        "lsb_deviation": round(lsb_deviation, 4),
        "segment_cv": round(seg_cv, 4),
        "stego_probability": stego_probability,
        "recommended_action": (
            "High suspicion — further analysis recommended" if stego_probability > 0.6
            else "Moderate suspicion — consider deeper analysis" if stego_probability > 0.3
            else "Likely clean — no obvious LSB steganography"
        ),
        "skipped": False,
    }

@app.post("/analyze/stego")
async def analyze_stego(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    return await _run_cpu(_analyze_stego_sync, contents, file.filename)

@app.post("/analyze/threat")
@app.post("/analyze/threat")
async def analyze_threat(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    file_hash = hashlib.sha256(contents).hexdigest()
    size = len(contents)
    
    threat_factors = 0
    indicators = []

    file_format = detect_file_format(contents)
    is_compressed_format = file_format in {"png", "jpeg", "webp", "gif", "tiff", "zip", "pdf", "rar", "gz", "mp4", "mkv", "riff"}
    filename = file.filename or "uploaded_file"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    # 1. Extension Mismatch Check
    known_ext_map = {
        "png": "png", "jpg": "jpeg", "jpeg": "jpeg", "webp": "webp", "gif": "gif",
        "pdf": "pdf", "zip": "zip", "exe": "pe", "dll": "pe", "elf": "elf"
    }
    expected_format = known_ext_map.get(ext)
    if expected_format and file_format and expected_format != file_format:
        if file_format in {"pe", "exe", "elf", "macho"}:
            threat_factors += 60
            indicators.append({
                "type": "extension_spoofing",
                "severity": "critical",
                "value": f".{ext} -> {file_format.upper()}",
                "description": f"CRITICAL: Extension Spoofing — file named .{ext} is actually an executable binary ({file_format.upper()})"
            })
        else:
            threat_factors += 15
            indicators.append({
                "type": "format_mismatch",
                "severity": "medium",
                "value": f".{ext} vs {file_format.upper()}",
                "description": f"Extension Mismatch: File has .{ext} extension but contains {file_format.upper()} container structure"
            })

    # 2. Context-aware Entropy Assessment
    entropy = 0.0
    if size > 0:
        data = np.frombuffer(contents, dtype=np.uint8)
        hist, _ = np.histogram(data, bins=256, range=(0, 256))
        hist = hist / hist.sum() if hist.sum() > 0 else hist
        entropy = float(-np.sum(hist * np.log2(hist + 1e-10)))

    if is_compressed_format:
        structure_ok = True
        if file_format == "png":
            structure_ok = b"IEND\xaeB`\x82" in contents
        elif file_format == "jpeg":
            structure_ok = b"\xff\xd9" in contents
        if entropy > 7.99 and not structure_ok:
            threat_factors += 10
            indicators.append({
                "type": "max_entropy",
                "severity": "medium",
                "value": f"{entropy:.4f}",
                "description": f"Maximum entropy ({entropy:.4f}) in {file_format.upper()} container with missing EOF structure — possibly obfuscated payload"
            })
        else:
            indicators.append({
                "type": "normal_compressed_entropy",
                "severity": "info",
                "value": f"{entropy:.4f}",
                "description": f"Normal expected entropy ({entropy:.4f}) for {file_format.upper() if file_format else 'compressed'} format"
            })
    else:
        if entropy > 7.4:
            threat_factors += 25
            indicators.append({
                "type": "high_entropy",
                "severity": "high",
                "value": f"{entropy:.4f}",
                "description": "High entropy in uncompressed file — likely encrypted or obfuscated payload"
            })
        elif entropy > 6.5:
            threat_factors += 10
            indicators.append({
                "type": "elevated_entropy",
                "severity": "medium",
                "value": f"{entropy:.4f}",
                "description": "Elevated entropy for uncompressed data"
            })

    # 3. Executable Header & Overlay Scan
    executable_headers_found = scan_executable_headers(contents, file_format)
    executable_count = len(executable_headers_found)
    if executable_count > 0:
        is_known_exec_ext = ext in {"exe", "dll", "elf", "so", "dylib", "sh", "bat", "cmd"}
        if is_known_exec_ext:
            indicators.append({
                "type": "valid_executable",
                "severity": "info",
                "value": executable_headers_found[0]["type"],
                "description": f"Valid executable binary signature ({executable_headers_found[0]['description']})"
            })
        else:
            threat_factors += 50
            for h in executable_headers_found:
                indicators.append({
                    "type": "executable_in_media",
                    "severity": "critical",
                    "value": h["type"],
                    "description": f"Executable header ({h['description']}) detected in non-executable container at offset {h['offset']}"
                })

    # 4. Appended Payload / EOF Overlay Scan
    overlay_found = False
    if file_format == "png":
        iend_idx = contents.find(b"IEND\xaeB`\x82")
        if iend_idx != -1 and (iend_idx + 12) < size:
            overlay_size = size - (iend_idx + 12)
            if overlay_size > 64:
                overlay_found = True
                threat_factors += 30
                indicators.append({
                    "type": "appended_overlay",
                    "severity": "high",
                    "value": f"{overlay_size} bytes",
                    "description": f"Appended Overlay Data: {overlay_size} bytes hidden past PNG IEND EOF marker"
                })
    elif file_format == "jpeg":
        eoi_idx = contents.rfind(b"\xff\xd9")
        if eoi_idx != -1 and (eoi_idx + 2) < size:
            overlay_size = size - (eoi_idx + 2)
            if overlay_size > 64:
                overlay_found = True
                threat_factors += 30
                indicators.append({
                    "type": "appended_overlay",
                    "severity": "high",
                    "value": f"{overlay_size} bytes",
                    "description": f"Appended Overlay Data: {overlay_size} bytes hidden past JPEG EOI marker"
                })

    # 5. Embedded Script Payload Scanner
    script_keywords = [b"<script", b"javascript:", b"eval(", b"WScript.Shell", b"powershell", b"cmd.exe", b"vbaProject.bin"]
    detected_scripts = [kw.decode("ascii", errors="ignore") for kw in script_keywords if kw in contents]
    if detected_scripts:
        threat_factors += 35
        indicators.append({
            "type": "script_payload",
            "severity": "high",
            "value": f"{len(detected_scripts)} vectors",
            "description": f"Embedded script/macro vectors detected: {', '.join(detected_scripts)}"
        })

    # 6. Malicious String Scan
    malicious_strings_found = scan_malicious_strings(contents)
    if malicious_strings_found:
        threat_factors += min(len(malicious_strings_found) * 10, 30)
        indicators.append({
            "type": "malicious_strings",
            "severity": "high",
            "value": f"{len(malicious_strings_found)} strings",
            "description": f"Suspicious API imports detected: {', '.join(malicious_strings_found[:5])}"
        })

    # 7. Positive Health Verification Indicators for Clean Files
    if file_format and not indicators:
        indicators.append({
            "type": "magic_byte_verified",
            "severity": "info",
            "value": file_format.upper(),
            "description": f"Magic Bytes Verified: Valid {file_format.upper()} container structure"
        })
        indicators.append({
            "type": "structure_health",
            "severity": "info",
            "value": "100% Clean",
            "description": "Structure Health: No appended payload overlay or hidden executable headers detected"
        })

    threat_score = float(min(threat_factors, 100))

    if threat_score >= 70:
        threat_level = "critical"
    elif threat_score >= 40:
        threat_level = "high"
    elif threat_score >= 20:
        threat_level = "medium"
    else:
        threat_level = "low"

    recommendations = []
    if threat_score == 0:
        recommendations.append("File container and entropy structures match official specifications. No malicious threat indicators detected.")
    else:
        if executable_count > 0 and threat_score >= 40:
            recommendations.append("DO NOT EXECUTE — executable code detected inside media container.")
        if overlay_found:
            recommendations.append("Appended overlay data detected past EOF marker — extract and inspect trailing bytes.")
        if detected_scripts:
            recommendations.append("Embedded script/macro vectors detected — do not open in un-sandboxed office tools.")
        recommendations.append("Verify SHA-256 hash against global threat intelligence feeds.")

    return {
        "filename": filename,
        "hash": file_hash,
        "size": size,
        "entropy": round(entropy, 4),
        "threat_score": threat_score,
        "threat_level": threat_level,
        "indicators": indicators,
        "recommendations": recommendations,
        "file_format": file_format,
    }

import re
import math

COMMON_PASSWORDS = {
    "password", "123456", "123456789", "qwerty", "abc123", "password123",
    "admin", "letmein", "welcome", "monkey", "dragon", "master", "hello",
    "freedom", "whatever", "qazwsx", "trustno1", "jordan", "harley",
    "12345678", "1234567", "password1", "12345", "1234567890", "qwerty123",
    "1q2w3e4r", "1qaz2wsx", "superman", "batman", "shadow", "michael",
    "ashley", "baseball", "football", "sunshine", "princess", "computer",
    "iloveyou", "hunter", "ranger", "starwars", "thomas", "robert",
    "jennifer", "michelle", "andrew", "joshua", "matthew", "amanda",
    "passw0rd", "p@ssword", "p@ssw0rd", "changeme", "secret", "summer",
    "winter", "spring", "autumn", "october", "november", "december",
    "orange", "maggie", "joshua1", "charlie", "daniel", "chester",
    "mustang", "corvette", "ferrari", "porsche", "mercedes", "yamaha",
    "honda", "kawasaki", "dallas", "houston", "atlanta", "chicago",
    "boston", "denver", "phoenix", "seattle", "orlando", "columbia",
}

PASSWORD_SEQUENCES = set()
def _build_sequences():
    rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
    for row in rows:
        for i in range(len(row) - 2):
            PASSWORD_SEQUENCES.add(row[i:i+3])
            PASSWORD_SEQUENCES.add(row[i:i+3][::-1])
    for i in range(8):
        PASSWORD_SEQUENCES.add(f"{i}{i+1}{i+2}")
        PASSWORD_SEQUENCES.add(f"{i+2}{i+1}{i}")
    for ch in "abcdefghijklmnopqrstuvwxyz":
        idx = ord(ch) - ord("a")
        if idx <= len("abcdefghijklmnopqrstuvwxyz") - 3:
            PASSWORD_SEQUENCES.add("abcdefghijklmnopqrstuvwxyz"[idx:idx+3])
            PASSWORD_SEQUENCES.add("abcdefghijklmnopqrstuvwxyz"[idx:idx+3][::-1])
_build_sequences()

def calculate_password_strength(password: str) -> dict:
    if not password:
        return {"score": 0, "strength": "very_weak", "feedback": "Password is empty", "entropy": 0}

    length = len(password)
    pw_lower = password.lower().strip()

    if pw_lower in COMMON_PASSWORDS:
        return {
            "score": 0, "strength": "very_weak",
            "feedback": "This is a commonly used password — change immediately",
            "entropy": 0, "crack_time_seconds": 0, "crack_time_display": "instant",
        }

    char_sets = {
        "lowercase": bool(re.search(r"[a-z]", password)),
        "uppercase": bool(re.search(r"[A-Z]", password)),
        "digits": bool(re.search(r"\d", password)),
        "symbols": bool(re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>? `~]", password)),
    }
    charset_types_used = sum(char_sets.values())

    if charset_types_used == 0:
        entropy = 0.0
    else:
        pool = 0
        if char_sets["lowercase"]: pool += 26
        if char_sets["uppercase"]: pool += 26
        if char_sets["digits"]: pool += 10
        if char_sets["symbols"]: pool += 33
        entropy = length * math.log2(pool)

    score = min(100, max(0, int(entropy * 1.5)))

    if length < 8:
        score = min(score, 15)
    elif length < 10:
        score = min(score, 40)
    elif length < 12:
        score = min(score, 65)
    elif length >= 16:
        score = max(score, 60)

    if re.search(r"(.)\1{2,}", password):
        score = max(0, score - 20)

    for seq in PASSWORD_SEQUENCES:
        if seq in pw_lower:
            score = max(0, score - 15)
            break

    if pw_lower[:3] in {"pass", "1234", "qwer", "abcd", "letm", "welc", "p@ss", "pa$$", "admin"}:
        score = max(0, score - 10)

    score = min(100, max(0, score))

    if score >= 80:
        strength, feedback = "very_strong", "Excellent password — highly resistant to attacks"
    elif score >= 60:
        strength, feedback = "strong", "Good password — consider adding length or more character types"
    elif score >= 40:
        strength, feedback = "fair", "Moderate strength — increase length, add mixed case, numbers, and symbols"
    elif score >= 20:
        strength, feedback = "weak", "Weak — use at least 12 characters with a mix of types"
    else:
        strength, feedback = "very_weak", "Very weak — easily guessable or cracked"

    crack_time = 2 ** entropy / 1e9 if entropy > 0 else 0

    return {
        "password_length": length,
        "strength_score": score,
        "strength": strength,
        "feedback": feedback,
        "entropy": round(entropy, 1),
        "charset_size": pool if charset_types_used > 0 else 0,
        "has_lowercase": char_sets["lowercase"],
        "has_uppercase": char_sets["uppercase"],
        "has_digits": char_sets["digits"],
        "has_symbols": char_sets["symbols"],
        "crack_time_seconds": round(crack_time, 1),
        "crack_time_display": format_crack_time(crack_time),
    }

def format_crack_time(seconds: float) -> str:
    if seconds < 1: return "instant"
    if seconds < 60: return f"{seconds:.1f} seconds"
    if seconds < 3600: return f"{seconds/60:.1f} minutes"
    if seconds < 86400: return f"{seconds/3600:.1f} hours"
    if seconds < 31536000: return f"{seconds/86400:.1f} days"
    return f"{seconds/31536000:.1f} years"

@app.post("/analyze/password")
async def analyze_password(data: dict = Body(...), auth=Depends(verify_auth)):
    password = data.get("password", "")
    result = calculate_password_strength(password)
    
    if "password_length" in result:
        return {
            "password_length": result["password_length"],
            "strength_score": result["strength_score"],
            "strength": result["strength"],
            "entropy_bits": result["entropy"],
            "feedback": result["feedback"],
            "checks": {
                "length": "excellent" if result["password_length"] >= 16 else "good" if result["password_length"] >= 12 else "minimum" if result["password_length"] >= 8 else "too_short",
                "character_variety": f"{sum([result['has_lowercase'], result['has_uppercase'], result['has_digits'], result['has_symbols']])}/4 types",
                "unique_char_ratio": "high" if result.get("charset_size", 0) > 50 else "medium" if result.get("charset_size", 0) > 20 else "low",
            },
            "recommendations": ["Use a password manager (Bitwarden, 1Password) to generate unique passwords", "Enable MFA on all accounts", "Never reuse passwords across sites"],
        }
    else:
        return {
            "password_length": len(password),
            "strength_score": result["score"],
            "strength": result["strength"],
            "entropy_bits": result["entropy"],
            "feedback": result["feedback"],
            "checks": {"common_password": "detected"},
            "recommendations": ["Change this password immediately — it's in common password lists"],
        }

@app.post("/analyze/metadata-risk")
async def analyze_metadata(data: dict = Body(...), auth=Depends(verify_auth)):
    metadata = data.get("metadata", {})
    field_keys = " ".join(metadata.keys()).lower()
    risks = []
    if any(kw in field_keys for kw in ["gpslat", "gpslong", "gpsalt", "gps"]):
        risks.append({"field": "GPS Coordinates", "risk": "high", "recommendation": "Remove GPS coordinates before sharing"})
    if any(kw in field_keys for kw in ["make", "model", "lens", "focal", "iso", "exposure"]):
        risks.append({"field": "Camera Info", "risk": "medium", "recommendation": "Remove camera make/model/settings"})
    if any(kw in field_keys for kw in ["software", "creator", "producer"]):
        risks.append({"field": "Software", "risk": "low", "recommendation": "Remove software identifier"})
    if any(kw in field_keys for kw in ["copyright", "artist", "rights"]):
        risks.append({"field": "Copyright", "risk": "low", "recommendation": "Remove copyright/author info"})
    return {
        "total_fields": len(metadata),
        "risks": risks,
        "overall_risk": "high" if any(r["risk"] == "high" for r in risks) else "medium" if risks else "low",
    }

def _detect_tamper_sync(contents: bytes, filename: str):
    with Image.open(io.BytesIO(contents)) as img:
        img_width, img_height = img.width, img.height
        if img_width * img_height > MAX_IMAGE_PIXELS:
            raise ValueError(f"Image dimensions ({img_width}x{img_height}) exceed maximum allowed limit of {MAX_IMAGE_PIXELS} pixels")
        is_screenshot = "screenshot" in filename.lower() or "screen" in filename.lower() or "capture" in filename.lower()
        img_array = np.array(img.convert("RGB"))

    gray = img_array.mean(axis=2)

    g = np.gradient(gray)
    gradient_mag = np.sqrt(g[0] ** 2 + g[1] ** 2)
    global_std = float(np.std(gradient_mag))

    h, w = gray.shape
    block_size = max(16, min(h, w) // 16)
    rows = max(1, h // block_size)
    cols = max(1, w // block_size)

    block_stds = []
    for r in range(rows):
        for c in range(cols):
            block = gradient_mag[r * block_size : (r + 1) * block_size, c * block_size : (c + 1) * block_size]
            if block.size > 0:
                block_stds.append(float(np.std(block)))

    block_cv = float(np.std(block_stds) / (np.mean(block_stds) + 1e-10)) if len(block_stds) > 1 else 0.0

    if is_screenshot:
        tamper_score = global_std * (1 + min(block_cv, 0.3)) * 0.3
        tamper_probability = float(min(tamper_score / 120, 0.15))
        analysis = "Clean screenshot / digital capture — normal UI edge gradients"
    else:
        tamper_score = global_std * (1 + block_cv)
        tamper_probability = float(min(tamper_score / 90, 1.0))
        if tamper_probability > 0.5:
            analysis = "Potential tampering detected — inconsistent edge patterns across image regions"
        elif tamper_probability > 0.3:
            analysis = "Suspicious — some edge inconsistencies found, further analysis recommended"
        else:
            analysis = "No significant tampering detected"

    return {
        "filename": filename,
        "dimensions": f"{img_width}x{img_height}",
        "tamper_score": round(tamper_score, 2),
        "tamper_probability": round(tamper_probability, 4),
        "analysis": analysis,
    }

@app.post("/detect/tamper")
async def detect_tamper(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    try:
        return await _run_cpu(_detect_tamper_sync, contents, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image analysis failed: {str(e)}")

EXECUTABLE_MAGIC_BYTES = [
    ("MZ", b"MZ", "Windows PE (DLL/EXE)"),
    ("ELF", b"\x7fELF", "Linux ELF"),
    ("Mach-O", b"\xfe\xed\xfa\xce", "macOS Mach-O (32-bit)"),
    ("Mach-O64", b"\xfe\xed\xfa\xcf", "macOS Mach-O (64-bit)"),
    ("Mach-O_Rev", b"\xce\xfa\xed\xfe", "macOS Mach-O reversed"),
    ("Script", b"#!", "Shell script"),
]

MALICIOUS_STRINGS = [
    b"CreateRemoteThread", b"VirtualAllocEx", b"WriteProcessMemory",
    b"URLDownloadToFile", b"WinExec", b"ShellExecuteA", b"ReflectiveLoader",
    b"NtUnmapViewOfSection", b"SetWindowsHookEx", b"lsass.exe",
]

def is_valid_pe_at_offset(data: bytes, offset: int) -> bool:
    if offset + 64 > len(data):
        return False
    try:
        e_lfanew = int.from_bytes(data[offset + 0x3C : offset + 0x3C + 4], "little")
        if e_lfanew < 64 or e_lfanew > 4096:
            return False
        pe_sig_offset = offset + e_lfanew
        if pe_sig_offset + 4 > len(data):
            return False
        return data[pe_sig_offset : pe_sig_offset + 4] == b"PE\x00\x00"
    except Exception:
        return False

def scan_executable_headers(data: bytes, file_format: Optional[str] = None):
    found = []
    
    # 1. Shebang script header is ONLY valid at offset 0
    if data.startswith(b"#!"):
        first_line = data[:100].split(b"\n")[0]
        if any(kw in first_line for kw in [b"/bin/", b"/usr/bin/", b"python", b"bash", b"sh", b"node", b"perl", b"env"]):
            found.append({
                "type": "Script",
                "description": "Shell/Interpreter Script",
                "offset": 0,
                "section": "header",
            })

    # 2. Check PE (MZ) Header
    idx = 0
    while True:
        idx = data.find(b"MZ", idx)
        if idx == -1:
            break
        if is_valid_pe_at_offset(data, idx):
            found.append({
                "type": "MZ",
                "description": "Windows PE Executable (DLL/EXE)",
                "offset": idx,
                "section": "header" if idx == 0 else "appended_payload" if idx > 512 else "data",
            })
            break  # Stop after finding valid PE to avoid duplicates
        idx += 1

    # 3. Check ELF Header
    if data.startswith(b"\x7fELF"):
        found.append({
            "type": "ELF",
            "description": "Linux ELF Executable",
            "offset": 0,
            "section": "header",
        })

    # 4. Check Mach-O Headers at offset 0
    for magic, name in [(b"\xfe\xed\xfa\xce", "Mach-O 32"), (b"\xfe\xed\xfa\xcf", "Mach-O 64"), (b"\xca\xfe\xba\xbe", "Mach-O Fat")]:
        if data.startswith(magic):
            found.append({
                "type": name,
                "description": "macOS Mach-O Binary",
                "offset": 0,
                "section": "header",
            })
            break

    return found[:10]

def scan_malicious_strings(data: bytes):
    found = []
    for s in MALICIOUS_STRINGS:
        idx = data.find(s)
        if idx != -1:
            before = data[idx - 1] if idx > 0 else 0
            after = data[idx + len(s)] if idx + len(s) < len(data) else 0
            is_boundary_before = not (65 <= before <= 90 or 97 <= before <= 122 or 48 <= before <= 57)
            is_boundary_after = not (65 <= after <= 90 or 97 <= after <= 122 or 48 <= after <= 57)
            if is_boundary_before and is_boundary_after:
                found.append(s.decode("ascii", errors="ignore"))
    return found

def analyze_segment_entropy(data: bytes, num_segments: int = 16):
    seg_size = max(1, len(data) // num_segments)
    entropies = []
    for i in range(num_segments):
        seg = data[i * seg_size : (i + 1) * seg_size]
        if len(seg) < 2:
            continue
        hist = np.frombuffer(seg, dtype=np.uint8)
        counts = np.bincount(hist, minlength=256).astype(np.float64)
        counts = counts[counts > 0]
        if len(counts) < 2:
            continue
        probs = counts / counts.sum()
        entropy = float(-np.sum(probs * np.log2(probs)))
        entropies.append(entropy)
    return entropies

def ela_analysis(img_bytes: bytes):
    try:
        original = Image.open(io.BytesIO(img_bytes))
        if original.format != "JPEG":
            return {"ela_score": 0.0, "ela_available": False, "reason": "Not a JPEG image"}

        buf = io.BytesIO()
        original.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        resaved = Image.open(buf)

        orig_arr = np.array(original.convert("RGB"), dtype=np.float64)
        resave_arr = np.array(resaved.convert("RGB"), dtype=np.float64)
        diff = np.abs(orig_arr - resave_arr).mean()

        original.close()
        resaved.close()
        return {
            "ela_score": round(float(diff), 4),
            "ela_available": True,
            "ela_probability": float(min(diff / 15, 1.0)),
            "reason": None,
        }
    except Exception:
        return {"ela_score": 0.0, "ela_available": False, "reason": "ELA processing failed"}

def detect_file_format(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8"):
        return "jpeg"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"RIFF"):
        return "riff"
    if data.startswith(b"BM"):
        return "bmp"
    if data.startswith(b"II*\x00") or data.startswith(b"MM\x00*"):
        return "tiff"
    if data.startswith(b"%PDF"):
        return "pdf"
    if data[:2] == b"MZ":
        return "pe"
    if data.startswith(b"\x7fELF"):
        return "elf"
    if data.startswith(b"\xfe\xed\xfa\xce") or data.startswith(b"\xce\xfa\xed\xfe"):
        return "macho"
    if data.startswith(b"\xfe\xed\xfa\xcf"):
        return "macho64"
    if data.startswith(b"PK\x03\x04"):
        return "zip"
    if data.startswith(b"PK\x05\x06") or data.startswith(b"PK\x07\x08"):
        return "zip"
    if data.startswith(b"Rar!\x1a\x07\x00"):
        return "rar"
    if data.startswith(b"\x37\x7a\xbc\xaf\x27\x1c"):
        return "7z"
    if data.startswith(b"SQLite format 3\x00"):
        return "sqlite"
    return None

def validate_file_structure(data: bytes):
    issues = []
    if len(data) < 16:
        issues.append("File too small to be a valid file")
        return {"valid": False, "issues": issues, "file_format": None}

    file_format = detect_file_format(data)
    if file_format is None:
        issues.append(f"Unknown or invalid file signature: {data[:8].hex()}")

    if file_format == "pdf":
        if not data.rstrip(b"\n\r").endswith(b"%%EOF"):
            issues.append("PDF missing %%EOF marker (truncated or corrupted)")
        # Check for cross-reference table
        if b"xref" not in data:
            issues.append("PDF missing cross-reference table")
    elif file_format == "jpeg":
        if not data.rstrip(b"\xff").endswith(b"\xd9"):
            issues.append("JPEG missing EOI marker (truncated)")
    elif file_format == "png":
        if len(data) < 41:
            issues.append("PNG file truncated")

    null_ratio = data.count(b"\x00") / len(data)
    if null_ratio > 0.5:
        issues.append(f"High null-byte ratio ({null_ratio:.1%}) — possible corruption or appended data")

    return {"valid": len(issues) == 0, "issues": issues, "file_format": file_format}

def _analyze_advanced_tamper_sync(contents: bytes, filename: str):
    result = {"filename": filename, "size": len(contents)}

    file_hash = hashlib.sha256(contents).hexdigest()
    result["sha256"] = file_hash

    file_struct = validate_file_structure(contents)
    result["file_structure"] = file_struct
    file_format = file_struct.get("file_format")
    COMPRESSED_FORMATS = {"png", "jpeg", "webp", "gif", "zip", "pdf", "rar", "7z"}

    mal_headers = scan_executable_headers(contents)
    mal_strings = scan_malicious_strings(contents)
    result["malware_scan"] = {
        "executable_headers_found": len(mal_headers),
        "headers": mal_headers[:10],
        "malicious_strings_found": len(mal_strings),
        "strings": mal_strings[:20],
        "has_malware_indicators": len(mal_headers) > 0 or len(mal_strings) > 0,
    }

    entropies = analyze_segment_entropy(contents)
    avg_entropy = float(np.mean(entropies)) if entropies else 0.0
    max_entropy = float(np.max(entropies)) if entropies else 0.0
    entropy_std = float(np.std(entropies)) if len(entropies) > 1 else 0.0
    
    is_compressed = file_format in COMPRESSED_FORMATS
    suspicious_entropy = (max_entropy > 7.99 and entropy_std > 0.8) if is_compressed else max_entropy > 7.5

    result["entropy_analysis"] = {
        "average_entropy": round(avg_entropy, 4),
        "max_entropy": round(max_entropy, 4),
        "std_dev": round(entropy_std, 4),
        "suspicious_segments": suspicious_entropy,
    }

    tamper_result = {"error": "Not an image"}
    ela_result = {"ela_score": 0.0, "ela_available": False}
    try:
        tamper_res = _detect_tamper_sync(contents, filename)
        tamper_result = {
            "dimensions": tamper_res.get("dimensions", "0x0"),
            "tamper_score": tamper_res.get("tamper_score", 0),
            "tamper_probability": tamper_res.get("tamper_probability", 0),
            "analysis": tamper_res.get("analysis", "Clean"),
        }
        ela_result = ela_analysis(contents)
    except Exception:
        tamper_result = {"error": "Not a valid image", "tamper_probability": 0.0}
        ela_result = {"ela_score": 0.0, "ela_available": False}

    result["tamper_analysis"] = tamper_result
    result["ela"] = ela_result

    image_like_formats = {"png", "jpeg", "bmp", "gif", "tiff", "webp"}
    audio_like_formats = {"riff"}
    if file_format in (image_like_formats | audio_like_formats):
        raw_data = np.frombuffer(contents, dtype=np.uint8)
        lsb_ones = int(np.sum(raw_data & 1))
        lsb_ratio = float(lsb_ones / len(raw_data)) if len(raw_data) > 0 else 0.5
        lsb_deviation = abs(lsb_ratio - 0.5)
        stego_suspicion = lsb_deviation > 0.05
    else:
        lsb_ratio = 0.5
        lsb_deviation = 0.0
        stego_suspicion = False
    result["lsb_analysis"] = {
        "lsb_ratio": round(lsb_ratio, 4),
        "lsb_deviation": round(lsb_deviation, 4),
        "stego_suspicion": stego_suspicion,
    }

    threat_factors = 0.0
    malware_count = len(result["malware_scan"]["headers"]) + len(result["malware_scan"]["strings"])
    if malware_count > 0:
        threat_factors += min(malware_count * 10, 40)
    tp = tamper_result.get("tamper_probability", 0) or 0
    if tp > 0.5:
        threat_factors += 25
    elif tp > 0.35:
        threat_factors += 10
    ep = ela_result.get("ela_probability", 0) or 0
    if ep > 0.6:
        threat_factors += 15
    if result["entropy_analysis"]["suspicious_segments"]:
        threat_factors += 15
    if result["lsb_analysis"].get("stego_suspicion"):
        threat_factors += 15
    if not file_struct["valid"]:
        threat_factors += 15

    threat_score = min(int(threat_factors), 100)
    if threat_score >= 70:
        threat_level = "critical"
    elif threat_score >= 40:
        threat_level = "high"
    elif threat_score >= 20:
        threat_level = "medium"
    else:
        threat_level = "low"

    result["threat_assessment"] = {
        "threat_score": threat_score,
        "threat_level": threat_level,
        "threat_breakdown": {
            "malware_indicators": malware_count > 0,
            "image_tampering": tp > 0.35,
            "ela_anomaly": ep > 0.6,
            "high_entropy": result["entropy_analysis"]["suspicious_segments"],
            "lsb_anomaly": result["lsb_analysis"].get("stego_suspicion", False),
            "file_corruption": not file_struct["valid"],
        },
    }

    return result

@app.post("/analyze/advanced-tamper")
async def analyze_advanced_tamper(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    return await _run_cpu(_analyze_advanced_tamper_sync, contents, file.filename)

def _detect_deepfake_sync(contents: bytes, filename: str):
    img = Image.open(io.BytesIO(contents))
    if img.mode not in ("RGB", "RGBA", "L", "LA", "CMYK", "YCbCr", "I", "F", "P"):
        img = img.convert("RGB")
    img_rgb = np.array(img.convert("RGB")).astype(float)
    gray = img_rgb.mean(axis=2)
    h, w = gray.shape

    if h < 32 or w < 32:
        img.close()
        return {
            "filename": filename,
            "deepfake_probability": 0.0, "confidence": 0.0,
            "analysis": "Image too small for analysis (minimum 32x32)",
            "features_analyzed": [],
        }

    if h * w > 1_000_000:
        scale = np.sqrt(1_000_000 / (h * w))
        nh, nw = int(h * scale), int(w * scale)
        img_small = np.array(img.resize((nw, nh), Image.LANCZOS)).astype(float)
        gray_small = img_small.mean(axis=2)
    else:
        img_small = img_rgb
        gray_small = gray

    sh, sw = gray_small.shape
    gray_var = float(np.var(gray_small))

    if gray_var < 1.0:
        img.close()
        return {
            "filename": filename,
            "deepfake_probability": 0.0, "confidence": 0.0,
            "analysis": "Solid color or uniform image — insufficient texture for deepfake analysis",
            "features_analyzed": [],
        }

    fft = np.fft.fft2(gray_small)
    fft_shift = np.fft.fftshift(fft)
    magnitude = np.abs(fft_shift)
    total_energy = magnitude.sum() + 1e-10

    cy, cx = sh // 2, sw // 2
    radius = min(sh, sw) // 8
    Y, X = np.ogrid[:sh, :sw]
    low_mask = (Y - cy) ** 2 + (X - cx) ** 2 <= radius ** 2
    high_freq_ratio = 1.0 - (magnitude[low_mask].sum() / total_energy)

    fr = img_small[:, :, 0].flatten()
    fg = img_small[:, :, 1].flatten()
    fb = img_small[:, :, 2].flatten()
    if len(fr) > 10_000:
        idx = np.random.default_rng().choice(len(fr), 10_000, replace=False)
        fr, fg, fb = fr[idx], fg[idx], fb[idx]

    rg_corr = float(np.corrcoef(fr, fg)[0, 1]) if np.std(fr) > 1e-6 and np.std(fg) > 1e-6 else 0.5
    rb_corr = float(np.corrcoef(fr, fb)[0, 1]) if np.std(fr) > 1e-6 and np.std(fb) > 1e-6 else 0.5
    gb_corr = float(np.corrcoef(fg, fb)[0, 1]) if np.std(fg) > 1e-6 and np.std(fb) > 1e-6 else 0.5

    rg_baseline = max(0.5, min(0.99, rg_corr))
    rb_baseline = max(0.3, min(0.95, rb_corr))
    gb_baseline = max(0.3, min(0.95, gb_corr))

    bs = max(16, min(sh, sw) // 16)
    rows_a = max(1, sh // bs)
    cols_a = max(1, sw // bs)
    block_vars = []
    for r in range(rows_a):
        for c in range(cols_a):
            block = gray_small[r * bs : (r + 1) * bs, c * bs : (c + 1) * bs]
            if block.size > 0:
                block_vars.append(float(np.var(block)))
    noise_cv = float(np.std(block_vars) / (np.mean(block_vars) + 1e-10)) if len(block_vars) > 1 else 0.0

    gy, gx = np.gradient(gray_small)
    edge_mag = np.sqrt(gy ** 2 + gx ** 2)
    edge_cv = float(np.std(edge_mag) / (np.mean(edge_mag) + 1e-10))

    freq_score = min(abs(high_freq_ratio - 0.2) * 3, 1.0)
    color_score = min((abs(rg_corr - rg_baseline) + abs(rb_corr - rb_baseline) + abs(gb_corr - gb_baseline)) * 0.5, 1.0)
    noise_score = min(noise_cv / 0.8, 1.0)
    edge_score = min(abs(edge_cv - 1.8) / 4.0, 1.0)

    deepfake_probability = round(float(np.clip((freq_score + color_score + noise_score + edge_score) / 4, 0, 1)), 4)
    confidence = round(float(np.clip(0.5 + (1.0 - deepfake_probability) * 0.4, 0.5, 0.95)), 4)

    if deepfake_probability > 0.6:
        analysis = "Strong indicators of synthetic manipulation detected"
    elif deepfake_probability > 0.3:
        analysis = "Some anomalies detected — further investigation recommended"
    else:
        analysis = "No deepfake indicators detected"

    img.close()

    return {
        "filename": filename,
        "deepfake_probability": deepfake_probability,
        "confidence": confidence,
        "analysis": analysis,
        "features_analyzed": ["frequency_domain", "color_correlation", "noise_consistency", "edge_coherence"],
    }

@app.post("/detect/deepfake")
async def detect_deepfake(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    try:
        return await _run_cpu(_detect_deepfake_sync, contents, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Deepfake analysis failed: {str(e)}")

@app.post("/generate/trust-score")
async def generate_trust_score(data: dict = Body(...), auth=Depends(verify_auth)):
    file_size = data.get("size", 0)
    file_type = data.get("type", "unknown")
    has_encryption = data.get("has_encryption", False)
    has_metadata = data.get("has_metadata", False)
    encryption_score = 95 if has_encryption else 20
    privacy_score = 85 if not has_metadata else 50
    integrity_score = 90
    threat_score = min(file_size / 100000, 30)
    stego_risk = min(file_size / 200000, 15)
    overall = (encryption_score + privacy_score + integrity_score + (100 - threat_score) + (100 - stego_risk)) / 5
    grade = "A+" if overall >= 95 else "A" if overall >= 90 else "B" if overall >= 80 else "C" if overall >= 70 else "D" if overall >= 60 else "F"
    return {
        "encryption_score": encryption_score,
        "privacy_score": privacy_score,
        "integrity_score": integrity_score,
        "threat_score": threat_score,
        "stego_risk": stego_risk,
        "overall_score": round(overall, 1),
        "grade": grade,
    }

@app.post("/analyze/security")
async def security_analysis(data: dict = Body(...), auth=Depends(verify_auth)):
    actions = data.get("recent_actions", [])
    issues = []
    if not data.get("mfa_enabled"):
        issues.append({"severity": "high", "title": "MFA Not Enabled", "description": "Enable multi-factor authentication"})
    if data.get("key_age_days", 0) > 90:
        issues.append({"severity": "medium", "title": "Keys Expiring", "description": "Rotate encryption keys"})
    if data.get("old_password", False):
        issues.append({"severity": "medium", "title": "Password Age", "description": "Update your master password"})
    suspicious_actions = [a for a in actions if a.get("type") == "failed_login"]
    if suspicious_actions:
        issues.append({"severity": "high", "title": "Failed Logins", "description": f"{len(suspicious_actions)} failed login attempts detected"})
    return {
        "security_score": max(0, 100 - len(issues) * 15),
        "issues": issues,
        "recommendations": [i["title"] for i in issues],
    }

@app.post("/generate/secret-language")
async def generate_secret_language(data: dict = Body(...), auth=Depends(verify_auth)):
    theme = data.get("theme", "fantasy")
    script_type = data.get("scriptType", "symbolic")
    complexity = data.get("complexity", "medium")
    include_digits = data.get("includeDigits", True)
    include_punctuation = data.get("includePunctuation", False)
    glyph_count = data.get("glyphCount", 26)

    glyphs = []
    seed = int.from_bytes(hashlib.sha256(f"{theme}:{script_type}:{complexity}".encode()).digest()[:4], "little")
    rng = np.random.default_rng(seed)

    unicode_ranges = {
        "symbolic": [(0x2600, 0x27BF), (0x2300, 0x23FF)],
        "runes": [(0x16A0, 0x16FF)],
        "cyrillic": [(0x0400, 0x04FF)],
        "greek": [(0x0370, 0x03FF)],
        "geometric": [(0x25A0, 0x25FF)],
        "dingbats": [(0x2700, 0x27BF)],
        "arrows": [(0x2190, 0x21FF)],
        "circled": [(0x2460, 0x24FF)],
    }

    range_key = script_type if script_type in unicode_ranges else "symbolic"
    ranges = unicode_ranges[range_key]

    letters = list("abcdefghijklmnopqrstuvwxyz")
    selected = letters[:min(glyph_count, 26)]

    seeds = {
        "fantasy": ["Ancient", "Arcane", "Mystic", "Elder", "Rune", "Sylvan", "Celestial", "Shadow", "Star", "Void"],
        "futuristic": ["Neon", "Cyber", "Quantum", "Digital", "Pulse", "Nexus", "Vector", "Apex", "Flux", "Core"],
        "nature": ["Forest", "River", "Stone", "Wind", "Flame", "Thorn", "Leaf", "Tide", "Storm", "Bloom"],
        "dark": ["Void", "Abyss", "Crypt", "Bone", "Blood", "Night", "Doom", "Wraith", "Hex", "Grave"],
        "celestial": ["Solar", "Lunar", "Nova", "Comet", "Nebula", "Aurora", "Zenith", "Orbit", "Pulsar", "Eclipse"],
    }
    theme_seeds = seeds.get(theme, seeds["fantasy"])

    used_codepoints = set()
    for i, letter in enumerate(selected):
        seed = theme_seeds[i % len(theme_seeds)]
        r = int(rng.integers(len(ranges)))
        start, end = ranges[r]
        candidates = [cp for cp in range(start, end + 1) if cp not in used_codepoints]
        if not candidates:
            candidates = [cp for cp in range(0x2600, 0x27BF) if cp not in used_codepoints]
        cp = int(rng.choice(candidates)) if candidates else 0x2600 + i
        used_codepoints.add(cp)

        glyphs.append({
            "character": letter,
            "symbol": chr(cp),
            "meaning": f"{seed} {letter.upper()}",
            "category": script_type,
        })

    if include_digits:
        digit_ranges = [(0x2460, 0x2468), (0x2776, 0x277E), (0xFF11, 0xFF19)]
        for i in range(10):
            r = digit_ranges[min(i // 3, 2)]
            cp = r[0] + (i % (r[1] - r[0] + 1))
            glyphs.append({
                "character": str(i),
                "symbol": chr(cp),
                "meaning": f"Digit {i}",
                "category": "digit",
            })

    if include_punctuation:
        punct_map = {'.': 0x3002, ',': 0x3001, '!': 0xFF01, '?': 0xFF1F, ':': 0xFF1A}
        for char, cp in punct_map.items():
            glyphs.append({
                "character": char,
                "symbol": chr(cp),
                "meaning": f"Punctuation {char}",
                "category": "punctuation",
            })

    lang_name_seed = rng.integers(1000, 9999)
    prefixes = ["Ae", "Ny", "Xy", "Zy", "Ka", "Ve", "Lo", "Qi", "Zu", "My"]
    suffixes = ["rian", "vani", "thari", "nari", "lith", "vok", "zar", "xis", "dor", "khan"]
    lang_name = f"{rng.choice(prefixes)}{rng.choice(suffixes)}"

    return {
        "name": lang_name,
        "theme": theme,
        "scriptType": script_type,
        "complexity": complexity,
        "glyphCount": len(glyphs),
        "glyphs": glyphs,
        "description": f"A {complexity} {theme}-inspired language using {script_type} script. Generated with {len(glyphs)} glyphs covering letters, {'digits, ' if include_digits else ''}{'punctuation, ' if include_punctuation else ''}and special symbols.",
        "version": "1.0",
    }

# Exact tag name sets (not substring matching) to prevent false positive categorization.
# e.g. 'makernote' must NOT match Camera via the 'make' keyword.
EXIF_CATEGORY_TAGS = {
    "GPS": {
        "gpsinfo", "gpslatitude", "gpslongitude", "gpsaltitude",
        "gpslatituderef", "gpslongituderef", "gpsaltituderef",
        "gpsspeed", "gpsspeedref", "gpsdatestamp", "gpstimestamp",
        "gpsimgdirection", "gpsimgdirectionref",
    },
    "Camera": {
        "make", "model", "lensmake", "lensmodel", "lensspecification",
        "focallength", "focallengthin35mmfilm", "fnumber", "aperturevalue",
        "iso", "isospeedratings", "exposuretime", "shutterspeedvalue",
        "exposuremode", "exposureprogram", "flash", "meteringmode",
        "whitebalance", "datetimeoriginal", "datetimedigitized", "datetime",
        "orientation", "resolutionunit", "xresolution", "yresolution",
        "sensingmethod", "scenecapturetype", "digitalzoomratio",
    },
    "Software": {
        "software", "creator", "producer", "hostcomputer",
        "processingsoft", "documentname",
    },
    "Copyright": {
        "copyright", "artist", "rights", "credit",
        "imagedescription", "usercomment",
    },
    "Thumbnail": {
        "thumbnail", "jfif", "exifthumbnail", "thumbnailoffset",
        "thumbnaillength", "jpeginterchanageformat",
    },
}

def _gps_to_decimal(values, ref: str) -> float | None:
    """Convert GPS DMS (degrees, minutes, seconds) to decimal degrees.
    Handles int/float, (numerator, denominator) rational tuples, and
    IFDRational-like objects that implement __float__.
    Returns None if conversion is not possible.
    """
    if values is None or (hasattr(values, "__iter__") and not isinstance(values, (str, bytes)) and len(list(values)) == 0):
        return None
    if not hasattr(values, "__iter__") or isinstance(values, (str, bytes)):
        return None

    parts: list[float] = []
    for x in values:
        if isinstance(x, bool):
            # bool is a subclass of int in Python — skip nonsense values
            return None
        elif isinstance(x, (int, float)):
            parts.append(float(x))
        elif isinstance(x, (list, tuple)) and len(x) == 2:
            num, den = x
            if den == 0:
                return None  # division by zero — invalid coordinate
            parts.append(float(num) / float(den))
        else:
            # IFDRational and similar objects that support __float__
            try:
                parts.append(float(x))
            except (TypeError, ValueError, ZeroDivisionError):
                return None  # do not silently inject 0 — drop the whole coordinate

    if len(parts) == 3:
        dec = parts[0] + parts[1] / 60.0 + parts[2] / 3600.0
    elif len(parts) == 2:
        dec = parts[0] + parts[1] / 60.0
    elif len(parts) == 1:
        dec = parts[0]
    else:
        return None

    # Basic sanity check: lat must be -90..90, lon -180..180
    # We can't distinguish lat from lon here, so just clamp to ±180
    if not (-180.0 <= dec <= 180.0):
        return None

    if ref and str(ref).strip().upper() in ("S", "W"):
        dec = -dec
    return round(dec, 6)


def extract_exif_data(img: Image.Image) -> dict:
    # Use the universal getexif() (Pillow 6+) which works for JPEG, PNG, TIFF, WebP.
    # _getexif() is JPEG-only and returns None for all other formats.
    exif_obj = None
    exif_data: dict = {}
    try:
        exif_obj = img.getexif()
        if exif_obj:
            exif_data = {tag_id: value for tag_id, value in exif_obj.items()}
    except Exception:
        exif_data = {}

    result = {
        "has_exif": len(exif_data) > 0,
        "fields": {},
        "categories": {},
        "gps_coordinates": None,
    }

    for tag_id, value in exif_data.items():
        tag_name = Image.ExifTags.TAGS.get(tag_id, f"TAG_{tag_id}").lower()
        str_val = str(value)
        result["fields"][tag_name] = str_val

        # Exact tag name matching (not substring) to prevent false positives
        # e.g. 'makernote' must not match Camera via the 'make' keyword.
        for cat, tag_set in EXIF_CATEGORY_TAGS.items():
            if tag_name in tag_set:
                result["categories"].setdefault(cat, {})[tag_name] = str_val
                break  # a tag belongs to exactly one primary category

    # Extract GPS sub-IFD using get_ifd() — critical fix:
    # getexif() stores 0x8825 as an integer offset (not the dict), so
    # exif_data.get(0x8825) returns an int, not the GPS fields dict.
    # get_ifd(0x8825) correctly resolves the sub-IFD into a real dict.
    try:
        gps_info = exif_obj.get_ifd(0x8825) if exif_obj is not None else {}
    except Exception:
        gps_info = {}

    if gps_info and isinstance(gps_info, dict):
        try:
            lat = _gps_to_decimal(gps_info.get(2), str(gps_info.get(1, "")))
            lon = _gps_to_decimal(gps_info.get(4), str(gps_info.get(3, "")))
            if lat is not None and lon is not None and -90.0 <= lat <= 90.0:
                result["gps_coordinates"] = {"latitude": lat, "longitude": lon}
        except Exception:
            pass

    return result

@app.post("/analyze/exif")
async def analyze_exif(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)

    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        return {
            "filename": file.filename,
            "is_image": False,
            "has_exif": False,
            "fields": {},
            "categories": {},
            "gps_coordinates": None,
            "total_fields": 0,
            "risk_level": "low",
            "risks": [],
            "recommendations": ["File is not a supported image format"],
        }
    
    exif = extract_exif_data(img)
    img.close()
    
    total = len(exif["fields"])
    risks = []
    
    if exif.get("gps_coordinates"):
        risks.append({
            "field": "GPS Coordinates",
            "severity": "high",
            "value": f"{exif['gps_coordinates']['latitude']}, {exif['gps_coordinates']['longitude']}",
            "recommendation": "Remove GPS coordinates before sharing",
        })
    
    if "Camera" in exif.get("categories", {}):
        risks.append({
            "field": "Camera Info",
            "severity": "medium",
            "value": ", ".join(exif["categories"]["Camera"].values()),
            "recommendation": "Remove camera make/model/settings",
        })
    
    if "Software" in exif.get("categories", {}):
        risks.append({
            "field": "Software",
            "severity": "low",
            "value": ", ".join(exif["categories"]["Software"].values()),
            "recommendation": "Remove software identifier",
        })
    
    if "Copyright" in exif.get("categories", {}):
        risks.append({
            "field": "Copyright",
            "severity": "low",
            "value": ", ".join(exif["categories"]["Copyright"].values()),
            "recommendation": "Remove copyright/author info before public sharing",
        })
    
    if "Thumbnail" in exif.get("categories", {}):
        risks.append({
            "field": "Thumbnail",
            "severity": "medium",
            "value": "Embedded thumbnail detected",
            "recommendation": "Strip thumbnail to reduce exposure",
        })
    
    if total > 0 and not risks:
        risks.append({
            "field": "EXIF Metadata",
            "severity": "low",
            "value": f"{total} EXIF fields found",
            "recommendation": "Consider stripping metadata for privacy",
        })
    
    risk_level = "high" if any(r["severity"] == "high" for r in risks) else "medium" if any(r["severity"] == "medium" for r in risks) else "low" if risks else "none"
    
    return {
        "filename": file.filename,
        "is_image": True,
        "has_exif": exif["has_exif"],
        "total_fields": total,
        "fields": exif["fields"],
        "categories": exif["categories"],
        "gps_coordinates": exif["gps_coordinates"],
        "risk_level": risk_level,
        "risks": risks,
        "recommendations": [r["recommendation"] for r in risks],
    }

@app.post("/clean/metadata")
async def clean_metadata(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    
    img_format = None
    try:
        img = Image.open(io.BytesIO(contents))
        img_format = img.format
    except Exception:
        raise HTTPException(status_code=400, detail="Unsupported image format for metadata cleaning")
    
    before = extract_exif_data(img)
    
    img_copy = img.copy()
    img.close()
    
    cleaned_buffer = io.BytesIO()
    save_kwargs = {"format": img_format or "PNG"}
    
    if img_format in ("JPEG", "TIFF"):
        clean_img = img_copy
        save_kwargs["exif"] = b""
        save_kwargs["icc_profile"] = None
    elif img_format == "PNG":
        clean_img = Image.new(img_copy.mode, img_copy.size)
        clean_img.paste(img_copy)
        clean_img.info.clear()
        save_kwargs["format"] = "PNG"
    elif img_format == "WEBP":
        clean_img = img_copy
        clean_img.info.clear()
        save_kwargs["exif"] = b""
        save_kwargs["lossless"] = True
    elif img_format == "GIF":
        gif_mode = img_copy.mode
        out_mode = "RGBA" if gif_mode in ("RGBA", "PA") else "RGB"
        clean_img = Image.new(out_mode, img_copy.size)
        clean_img.putdata(list(img_copy.convert(out_mode).getdata()))
        save_kwargs = {"format": "PNG"}
    elif img_format == "BMP":
        clean_img = img_copy
    else:
        clean_img = img_copy
    
    clean_img.save(cleaned_buffer, **save_kwargs)
    clean_img.close()
    
    cleaned_bytes = cleaned_buffer.getvalue()
    removed = list(before["categories"].keys()) if before["has_exif"] else []
    
    return {
        "filename": file.filename,
        "cleaned": before["has_exif"],
        "removed_categories": removed,
        "removed_fields_count": len(before["fields"]),
        "original_size": len(contents),
        "cleaned_size": len(cleaned_bytes),
        "size_reduction": len(contents) - len(cleaned_bytes),
        "cleaned_file_base64": base64.b64encode(cleaned_bytes).decode(),
    }

FILE_SIGNATURES = [
    ("PNG Image", bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), "png"),
    ("JPEG Image", bytes([0xFF, 0xD8, 0xFF]), "jpg"),
    ("GIF Image", b"GIF8", "gif"),
    ("ZIP Archive", bytes([0x50, 0x4B, 0x03, 0x04]), "zip"),
    ("PDF Document", b"%PDF", "pdf"),
    ("ELF Binary", bytes([0x7F, 0x45, 0x4C, 0x46]), "elf"),
    ("Windows PE", b"MZ", "exe"),
    ("RIFF (AVI/WAV)", b"RIFF", "avi"),
    ("Mach-O", bytes([0xFE, 0xED, 0xFA, 0xCE]), "macho"),
    ("SQLite DB", b"SQLite format 3\x00", "sqlite"),
    ("BMP Image", b"BM", "bmp"),
    ("TIFF Image", b"II*\x00", "tiff"),
    ("7z Archive", bytes([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]), "7z"),
    ("RAR Archive", b"Rar!\x1a\x07\x00", "rar"),
    ("WebP Image", bytes([0x52, 0x49, 0x46, 0x46]), "webp"),
]

@app.post("/analyze/strings")
async def extract_strings(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    result = []
    current = ""
    for byte in contents:
        if 32 <= byte <= 126:
            current += chr(byte)
        else:
            if len(current) >= 6:
                result.append(current)
            current = ""
    if len(current) >= 6:
        result.append(current)
    return {
        "filename": file.filename,
        "total_strings": len(result),
        "strings": result[:100],
    }

@app.post("/analyze/carve")
async def carve_embedded(file: UploadFile = File(...), auth=Depends(verify_auth)):
    contents = await validate_file_size(file)
    found = []
    for name, magic, ext in FILE_SIGNATURES:
        offset = 0
        while True:
            idx = contents.find(magic, offset)
            if idx == -1:
                break
            if idx > 0:
                if name == "Windows PE" and not is_valid_pe_at_offset(contents, idx):
                    offset = idx + 1
                    continue
                found.append({
                    "type": name,
                    "offset": idx,
                    "extension": ext,
                    "size_hint": len(contents) - idx,
                })
            offset = idx + 1
            if len(found) >= 50:
                break
    return {
        "filename": file.filename,
        "total_embedded": len(found),
        "embedded": found,
    }

SYSTEM_PROMPT = """You are StegShield X AI, an expert cybersecurity assistant. You help with:
- Steganalysis, digital forensics, threat detection, password security
- Metadata privacy, tamper detection, deepfake analysis, encryption
- Security best practices and risk assessment

Be concise, technical, and accurate. Provide actionable advice."""

SECURITY_TOPICS = {
    "password": (
        "**Password Security Analysis**\n\n"
        "A strong password should:\n"
        "- Be at least **12-16 characters** long\n"
        "- Include uppercase, lowercase, numbers, and special characters\n"
        "- Avoid common words, patterns, or personal info\n"
        "- Be **unique** for each account\n\n"
        "Use a password manager (Bitwarden, 1Password) to generate and store complex passwords."
    ),
    "stego": (
        "**Steganalysis Overview**\n\n"
        "Steganography hides data inside innocent-looking files. Detection methods:\n"
        "- **LSB Analysis** \u2014 checks if least significant bits deviate from expected 50/50\n"
        "- **Entropy Analysis** \u2014 encrypted/hidden data has higher randomness\n"
        "- **File Structure** \u2014 looks for appended data after expected file endings\n\n"
        "Upload a file in the **Analyze** tab for steganographic analysis."
    ),
    "threat": (
        "**Threat Detection**\n\n"
        "Malicious file indicators:\n"
        "- **High entropy** > 7.5 \u2192 possible encrypted/obfuscated payloads\n"
        "- **Executable headers** (MZ, ELF) in non-executable files\n"
        "- **Suspicious API calls** (CreateRemoteThread, VirtualAlloc, WinExec)\n"
        "- **Embedded files** inside other files\n\n"
        "Upload a file in the **Threat Detection** tab for a full scan."
    ),
    "encrypt": (
        "**Encryption Best Practices**\n\n"
        "- **AES-256-GCM** for file encryption (gold standard)\n"
        "- Use **age** (modern) or **GPG** (cross-platform) tools\n"
        "- Enable **Full Disk Encryption** (BitLocker, FileVault, LUKS)\n"
        "- Transit: **TLS 1.3** | At rest: **AES-256** or **ChaCha20-Poly1305**"
    ),
    "mfa": (
        "**Multi-Factor Authentication**\n\n"
        "Types ranked best to worst:\n"
        "1. **Security Keys** (FIDO2/WebAuthn) \u2014 gold standard\n"
        "2. **TOTP Apps** (Authy, Google Authenticator) \u2014 good\n"
        "3. **SMS/Email codes** \u2014 better than nothing\n\n"
        "Enable MFA in **Settings > Security** to protect your account."
    ),
    "deepfake": (
        "**Deepfake Detection**\n\n"
        "AI-powered analysis checks:\n"
        "- **Frequency Domain** \u2014 unusual high-frequency patterns\n"
        "- **Color Correlation** \u2014 unnatural RGB channel relationships\n"
        "- **Noise Consistency** \u2014 composited regions show different noise\n"
        "- **Edge Coherence** \u2014 artifacts at blending boundaries\n\n"
        "Upload a suspicious image in the **Tamper Detection** tab."
    ),
    "tamper": (
        "**Image Tamper Detection**\n\n"
        "Forgery detection techniques:\n"
        "- **Gradient Analysis** \u2014 inconsistent edge patterns\n"
        "- **ELA** \u2014 JPEG re-compression reveals composites\n"
        "- **Block Analysis** \u2014 statistical variance between image blocks\n\n"
        "Upload an image in the **Tamper Detection** tab."
    ),
    "metadata": (
        "**Metadata Privacy**\n\n"
        "Images contain hidden metadata:\n"
        "- \U0001f4cd **GPS coordinates** \u2014 where the photo was taken\n"
        "- \U0001f4f7 **Camera model/lens/settings** \u2014 identifies the photographer\n"
        "- \U0001f5a5\ufe0f **Software** \u2014 editing tools used\n\n"
        "Use the **Metadata Privacy** tool to analyze and strip this data."
    ),
    "forensic": (
        "**Digital Forensics**\n\n"
        "Full analysis includes:\n"
        "1. **Hash Verification** \u2014 SHA-256 + MD5 integrity\n"
        "2. **Entropy Analysis** \u2014 detect hidden payloads\n"
        "3. **LSB Steganalysis** \u2014 find hidden data\n"
        "4. **Malware Scan** \u2014 executable headers + suspicious strings\n"
        "5. **Embedded Carving** \u2014 files hidden inside files\n"
        "6. **String Extraction** \u2014 forensic string analysis\n\n"
        "Run a full analysis in the **Digital Forensics** tool."
    ),
}


def generate_local_response(messages: list) -> str:
    if not messages:
        return _greeting()
    last = messages[-1]["content"].lower()

    for key, response in SECURITY_TOPICS.items():
        if key in last:
            return response

    if any(w in last for w in ["hi", "hello", "hey", "help"]):
        return _greeting()
    return _greeting()


def _greeting() -> str:
    return (
        "**Welcome to StegShield X AI Security Assistant** \U0001f512\n\n"
        "I can help you with:\n\n"
        "- **\U0001f510 Password Security** \u2014 Check password strength\n"
        "- **\U0001f575\ufe0f Steganalysis** \u2014 Detect hidden data in files\n"
        "- **\U0001f6e1\ufe0f Threat Detection** \u2014 Scan files for malware\n"
        "- **\U0001f4f7 Tamper Detection** \u2014 Detect image forgeries\n"
        "- **\U0001f916 Deepfake Analysis** \u2014 AI-generated media detection\n"
        "- **\U0001f3f7\ufe0f Metadata Privacy** \u2014 Analyze and strip EXIF data\n"
        "- **\U0001f50e Digital Forensics** \u2014 Full forensic file analysis\n"
        "- **\U0001f511 Encryption** \u2014 Best practices for data protection\n\n"
        "**Ask me a question** or use the tabs above to run analyses."
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

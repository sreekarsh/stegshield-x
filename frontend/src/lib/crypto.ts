import {
  detectFormat,
  canUseSpatialLsb,
  parseWavDataChunk,
  embedAppendSteno,
  extractAppendSteno,
  imageToPixels,
} from "./stego-formats"
import { useAuthStore } from "@/store/useAuthStore"

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState()?.accessToken ?? null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function protectPdf(
  file: File,
  password: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("password", password)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/pdf/protect`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    }
  )
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Protection failed" }))
    throw new Error(err.message || `Protection failed (${response.status})`)
  }
  return response.blob()
}

export async function unlockPdf(
  file: File,
  password: string
): Promise<Blob> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("password", password)
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/pdf/unlock`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    }
  )
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Unlock failed" }))
    throw new Error(err.message || `Unlock failed (${response.status})`)
  }
  return response.blob()
}

function getAlgoParams(algo: string): { name: string; length: number } {
  if (algo === "AES-GCM") return { name: "AES-GCM", length: 256 }
  throw new Error(`Unsupported algorithm: ${algo}`)
}

export async function generateAESKey(algo: string): Promise<CryptoKey> {
  const params = getAlgoParams(algo)
  return crypto.subtle.generateKey(
    { name: params.name, length: params.length },
    true,
    ["encrypt", "decrypt"]
  )
}

export async function exportCryptoKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)))
  return base64
}

export async function importCryptoKey(keyStr: string, algo: string): Promise<CryptoKey> {
  const params = getAlgoParams(algo)
  const raw = Uint8Array.from(atob(keyStr), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: params.name, length: params.length },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function detectEncryptedAlgorithm(file: File): Promise<string> {
  const header = await file.slice(0, 4).arrayBuffer()
  const magic = new Uint8Array(header)
  if (magic[0] === 0x47 && magic[1] === 0x43 && magic[2] === 0x4d) return "AES-GCM"
  throw new Error("Unrecognized encrypted file format. This file was not created by Image Encryption.")
}

async function encryptData(
  data: ArrayBuffer,
  algo: string,
  key: CryptoKey,
  mimeType?: string,
  originalName?: string,
): Promise<{ encrypted: ArrayBuffer }> {
  const mimeEncoded = mimeType ? new TextEncoder().encode(mimeType) : null
  const mimeLen = mimeEncoded?.length ?? 0
  const extEncoded = originalName ? new TextEncoder().encode(originalName) : null
  const extLen = extEncoded?.length ?? 0
  const headerSize = 4 + 2 + mimeLen + 2 + extLen

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    data
  )
  const result = new Uint8Array(headerSize + iv.length + encrypted.byteLength)
  result[0] = 0x47; result[1] = 0x43; result[2] = 0x4d; result[3] = originalName ? 0x02 : mimeType ? 0x01 : 0x00
  result[4] = (mimeLen >> 8) & 0xff
  result[5] = mimeLen & 0xff
  let offset = 6
  if (mimeEncoded) { result.set(mimeEncoded, offset); offset += mimeLen }
  result[offset] = (extLen >> 8) & 0xff; result[offset + 1] = extLen & 0xff; offset += 2
  if (extEncoded) result.set(extEncoded, offset)
  result.set(iv, headerSize)
  result.set(new Uint8Array(encrypted), headerSize + iv.length)
  return { encrypted: result.buffer as ArrayBuffer }
}

async function decryptData(encrypted: ArrayBuffer, key: CryptoKey): Promise<{ data: ArrayBuffer; mimeType?: string; originalName?: string }> {
  const view = new Uint8Array(encrypted)
  if (view[0] !== 0x47 || view[1] !== 0x43 || view[2] !== 0x4d) throw new Error("Not a valid GCM-encrypted file")
  const version = view[3]

  let mimeType: string | undefined
  let originalName: string | undefined

  const mimeLen = version >= 0x01 ? (view[4] << 8) | view[5] : 0
  let offset = 6
  if (mimeLen > 0) {
    mimeType = new TextDecoder().decode(encrypted.slice(offset, offset + mimeLen))
    offset += mimeLen
  }

  const extLen = version >= 0x02 ? (view[offset] << 8) | view[offset + 1] : 0
  offset += 2
  if (extLen > 0) {
    originalName = new TextDecoder().decode(encrypted.slice(offset, offset + extLen))
    offset += extLen
  }

  const iv = encrypted.slice(offset, offset + 12)
  const encData = encrypted.slice(offset + 12)

  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encData)
  return { data, mimeType, originalName }
}

export async function encryptFile(
  file: File,
  algo: string,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob }> {
  const data = await file.arrayBuffer()
  const name = file.name
  const { encrypted } = await encryptData(data, algo, key, file.type || undefined, name)
  return { encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }) }
}

export async function decryptFile(
  file: File,
  key: CryptoKey
): Promise<{ blob: Blob; originalName?: string }> {
  const data = await file.arrayBuffer()
  const { data: decrypted, originalName } = await decryptData(data, key)
  const mimeType = originalName ? guessMimeFromName(originalName) : undefined
  return { blob: new Blob([decrypted], { type: mimeType || "application/octet-stream" }), originalName }
}

function guessMimeFromName(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext) return undefined
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", csv: "text/csv", json: "application/json", xml: "application/xml",
    zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
    mp3: "audio/mpeg", mp4: "video/mp4", wav: "audio/wav",
  }
  return map[ext]
}

export async function encryptImageFile(
  file: File,
  algo: string,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob }> {
  const data = await file.arrayBuffer()
  const { encrypted } = await encryptData(data, algo, key, file.type, file.name)
  return { encryptedBlob: new Blob([encrypted], { type: "application/octet-stream" }) }
}

export async function decryptImageFile(
  file: File,
  key: CryptoKey
): Promise<{ blob: Blob; mimeType?: string; originalName?: string }> {
  const data = await file.arrayBuffer()
  const { data: decrypted, mimeType, originalName } = await decryptData(data, key)
  return { blob: new Blob([decrypted], { type: mimeType || "image/png" }), mimeType, originalName }
}

const STEGO_SALT = new TextEncoder().encode("stegshield-stego-v1")
const STEGO_PBKDF2_ITERATIONS = 100000

async function deriveStegoKey(key: string, usage: KeyUsage): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: STEGO_SALT, iterations: STEGO_PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  )
}

export async function decodeMessage(payload: Uint8Array, key?: string): Promise<string> {
  if (payload.length < 4) return ""
  const len = (payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]
  if (len === 0) return ""
  const raw = payload.slice(4, 4 + len)
  if (raw.length === 0) return ""

  if (key && raw.length > 0 && raw[0] === 0x01) {
    try {
      const iv = raw.slice(1, 13)
      const ciphertext = raw.slice(13)
      const aesKey = await deriveStegoKey(key, "decrypt")
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, ciphertext)
      return new TextDecoder().decode(decrypted).replace(/\0+$/, "")
    } catch {
      throw new Error("Decryption failed — wrong passphrase or corrupted data")
    }
  }

  if (key) {
    const keyBytes = new TextEncoder().encode(key)
    const msgBytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) msgBytes[i] = raw[i] ^ keyBytes[i % keyBytes.length]
    return new TextDecoder().decode(msgBytes).replace(/\0+$/, "")
  }

  return new TextDecoder().decode(raw).replace(/\0+$/, "")
}

function extractLsbPayload(data: Uint8Array, startBit: number): Uint8Array {
  // Need at least 32 bits for the length header
  if (data.length < startBit + 32) return new Uint8Array(4)

  let len = 0
  for (let b = 0; b < 32; b++) {
    len = (len << 1) | (data[startBit + b] & 1)
  }

  // Sanity check: length must be > 0 and fit within available data
  // Max sensible message is 10MB; also must have enough bits in the carrier
  const MAX_PAYLOAD = 10 * 1024 * 1024
  const availableBits = data.length - startBit - 32
  const availableBytes = Math.floor(availableBits / 8)

  if (len === 0 || len > MAX_PAYLOAD || len > availableBytes) {
    // No valid hidden data — return empty payload
    return new Uint8Array(4)
  }

  const result = new Uint8Array(4 + len)
  result[0] = (len >> 24) & 0xff
  result[1] = (len >> 16) & 0xff
  result[2] = (len >> 8) & 0xff
  result[3] = len & 0xff
  let bitIdx = startBit + 32
  for (let i = 0; i < len; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (data[bitIdx] & 1)
      bitIdx++
    }
    result[4 + i] = byte
  }
  return result
}

function embedLsbBytes(data: Uint8Array, startBit: number, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(data)
  let bitIdx = startBit
  for (const byte of payload) {
    for (let b = 7; b >= 0; b--) {
      result[bitIdx] = (result[bitIdx] & 0xfe) | ((byte >> b) & 1)
      bitIdx++
    }
  }
  return result
}

export async function preparePayload(message: string, key?: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(message)
  let msgBytes: Uint8Array

  if (key) {
    const aesKey = await deriveStegoKey(key, "encrypt")
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, encoded)
    msgBytes = new Uint8Array(1 + 12 + encrypted.byteLength)
    msgBytes[0] = 0x01
    msgBytes.set(iv, 1)
    msgBytes.set(new Uint8Array(encrypted), 13)
  } else {
    msgBytes = encoded
  }

  const len = msgBytes.length
  const payload = new Uint8Array(4 + len)
  payload[0] = (len >> 24) & 0xff
  payload[1] = (len >> 16) & 0xff
  payload[2] = (len >> 8) & 0xff
  payload[3] = len & 0xff
  payload.set(msgBytes, 4)
  return payload
}

export async function steganographyEncode(
  data: Uint8Array,
  message: string,
  key?: string
): Promise<Uint8Array> {
  const payload = await preparePayload(message, key)
  const needed = payload.length * 8
  if (needed > data.length * 8) throw new Error("Message too large for carrier")
  return embedLsbBytes(data, 0, payload)
}

export async function steganographyDecode(
  data: Uint8Array,
  key?: string
): Promise<string> {
  const payload = extractLsbPayload(data, 0)
  return decodeMessage(payload, key)
}

/** Extract only RGB bytes from RGBA pixel array (skip every 4th alpha byte) */
function rgbOnlyFromRgba(rgba: Uint8Array): Uint8Array {
  const rgb = new Uint8Array(Math.floor(rgba.length * 3 / 4))
  let j = 0
  for (let i = 0; i < rgba.length; i++) {
    if (i % 4 !== 3) rgb[j++] = rgba[i]
  }
  return rgb
}

/** Write modified RGB bytes back into RGBA array, forcing alpha=255 */
function rgbIntoRgba(rgba: Uint8Array, rgb: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length)
  let j = 0
  for (let i = 0; i < rgba.length; i++) {
    if (i % 4 === 3) {
      out[i] = 255  // force fully opaque — prevents premultiplied-alpha corruption
    } else {
      out[i] = rgb[j++]
    }
  }
  return out
}

export async function steganographyEncodeImage(
  file: File,
  message: string,
  key?: string
): Promise<Blob> {
  const { pixels, width, height } = await imageToPixels(file)
  // Only embed in RGB channels — alpha embedding corrupts data via canvas premult-alpha round-trip
  const rgbPixels = rgbOnlyFromRgba(pixels)
  const payload = await preparePayload(message, key)
  const needed = payload.length * 8
  if (needed > rgbPixels.length) throw new Error("Message too large for image")
  const encodedRgb = embedLsbBytes(rgbPixels, 0, payload)
  // Reconstruct RGBA: RGB from encoded bytes, alpha forced to 255
  const encodedPixels = rgbIntoRgba(pixels, encodedRgb)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(encodedPixels)
  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to encode image"))
    }, "image/png")
  })
}

export async function steganographyDecodeImage(
  file: File,
  key?: string
): Promise<string> {
  const { pixels } = await imageToPixels(file)
  // Only read from RGB channels — matches encoding which skipped alpha
  const rgbPixels = rgbOnlyFromRgba(pixels)
  const payload = extractLsbPayload(rgbPixels, 0)
  return decodeMessage(payload, key)
}

export async function steganographyEncodeFile(
  file: File,
  message: string,
  key?: string
): Promise<Blob> {
  const buffer = await file.slice(0, 16).arrayBuffer()
  const magic = new Uint8Array(buffer)
  const format = detectFormat(file.name, magic)
  const payload = await preparePayload(message, key)

  // WAV: embed in audio sample LSBs (raw PCM bytes — no browser rendering pipeline, reliable)
  if (format === "WAV") {
    const full = new Uint8Array(await file.arrayBuffer())
    const wav = parseWavDataChunk(full)
    if (!wav) throw new Error("Invalid WAV file: could not find data chunk")
    const needed = payload.length * 8
    if (needed > wav.size * 8) throw new Error("Message too large for WAV carrier")
    const result = embedLsbBytes(full, wav.offset, payload)
    return new Blob([result.buffer as ArrayBuffer], { type: "audio/wav" })
  }

  // All image formats (PNG, JPEG, BMP, GIF) and other containers:
  // Use append-after-EOF steno — bypasses canvas color-pipeline which corrupts pixel LSBs.
  // Image data is untouched; payload is appended after the image's EOF marker.
  const mimeMap: Record<string, string> = {
    PNG: "image/png",
    JPEG: "image/jpeg",
    BMP: "image/bmp",
    GIF: "image/gif",
    MP3: "audio/mpeg",
    MP4: "video/mp4",
    PDF: "application/pdf",
  }
  const full = new Uint8Array(await file.arrayBuffer())
  const stego = embedAppendSteno(full, payload)
  return new Blob([stego.buffer as ArrayBuffer], { type: mimeMap[format] || "application/octet-stream" })
}

export async function steganographyDecodeFile(
  file: File,
  key?: string
): Promise<string> {
  const buffer = await file.slice(0, 16).arrayBuffer()
  const magic = new Uint8Array(buffer)
  const format = detectFormat(file.name, magic)

  // WAV: extract from audio sample LSBs
  if (format === "WAV") {
    const full = new Uint8Array(await file.arrayBuffer())
    const wav = parseWavDataChunk(full)
    if (!wav) throw new Error("Invalid WAV file")
    const payload = extractLsbPayload(full, wav.offset)
    return decodeMessage(payload, key)
  }

  // All image formats and other containers: extract append-after-EOF payload
  const full = new Uint8Array(await file.arrayBuffer())
  const extracted = extractAppendSteno(full)
  return decodeMessage(extracted ?? new Uint8Array(0), key)
}

const TC_SALT = new TextEncoder().encode("stegshield-timecapsule-v1")
const TC_ITERATIONS = 600000

async function deriveTimeCapsuleKey(passphrase: string, usage: KeyUsage): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: TC_SALT, iterations: TC_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  )
}

export async function encryptTimeCapsule(plaintext: string, passphrase: string): Promise<string> {
  const key = await deriveTimeCapsuleKey(passphrase, "encrypt")
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encoded)
  const combined = new Uint8Array(1 + 12 + encrypted.byteLength)
  combined.set([0x54], 0)
  combined.set(iv, 1)
  combined.set(new Uint8Array(encrypted), 13)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptTimeCapsule(encryptedBase64: string, passphrase: string): Promise<string> {
  const raw = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0))
  if (raw.length < 14 || raw[0] !== 0x54) throw new Error("Invalid encrypted data format")
  const iv = raw.slice(1, 13)
  const ciphertext = raw.slice(13)
  const key = await deriveTimeCapsuleKey(passphrase, "decrypt")
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

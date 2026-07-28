const KEY_TAG = "stegshield_store_key"

function getSessionKey(): string | null {
  if (typeof window === "undefined") return null
  let key = localStorage.getItem(KEY_TAG)
  if (!key) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("")
    localStorage.setItem(KEY_TAG, key)
  }
  return key
}

async function deriveKey(keyHex: string): Promise<CryptoKey> {
  const raw = new Uint8Array(keyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

export async function encryptStore<T>(data: T): Promise<string> {
  const keyHex = getSessionKey()
  if (!keyHex) return btoa(JSON.stringify(data))
  const key = await deriveKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  let binary = ""
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i])
  return "v1:" + btoa(binary)
}

export async function decryptStore<T>(encoded: string): Promise<T | null> {
  if (!encoded.startsWith("v1:")) {
    try { return JSON.parse(atob(encoded)) as T } catch { return null }
  }
  const keyHex = getSessionKey()
  if (!keyHex) return null
  try {
    const key = await deriveKey(keyHex)
    const raw = Uint8Array.from(atob(encoded.slice(3)), c => c.charCodeAt(0))
    const iv = raw.slice(0, 12)
    const data = raw.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
    return JSON.parse(new TextDecoder().decode(decrypted)) as T
  } catch {
    return null
  }
}

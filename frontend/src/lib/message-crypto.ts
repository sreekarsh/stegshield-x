const KEY_STORAGE = "stegshield_msg_key"

function getConversationKey(): Promise<CryptoKey> {
  const raw = localStorage.getItem(KEY_STORAGE)
  if (raw) {
    return crypto.subtle.importKey("raw", hexToAB(raw), "AES-GCM", false, ["encrypt", "decrypt"])
  }
  const key = crypto.getRandomValues(new Uint8Array(32))
  const hex = bufToHex(key)
  localStorage.setItem(KEY_STORAGE, hex)
  return crypto.subtle.importKey("raw", key.buffer as ArrayBuffer, "AES-GCM", false, ["encrypt", "decrypt"])
}

function hexToAB(hex: string): ArrayBuffer {
  const bytes = hex.match(/.{2}/g)!.map(b => parseInt(b, 16))
  const ab = new ArrayBuffer(bytes.length)
  new Uint8Array(ab).set(bytes)
  return ab
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("")
}

export async function encryptMessageContent(plaintext: string): Promise<string> {
  const key = await getConversationKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  let binary = ""
  for (let i = 0; i < combined.length; i++) binary += String.fromCharCode(combined[i])
  return "enc:" + btoa(binary)
}

export async function decryptMessageContent(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith("enc:")) return ciphertext
  try {
    const key = await getConversationKey()
    const raw = Uint8Array.from(atob(ciphertext.slice(4)), c => c.charCodeAt(0))
    const iv = raw.slice(0, 12)
    const data = raw.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data.buffer)
    return new TextDecoder().decode(decrypted)
  } catch {
    return "[decryption failed]"
  }
}

export function isSelfDestructed(msg: { selfDestruct?: boolean; oneTimeView?: boolean; isRead?: boolean; readAt?: string; createdAt: string }): boolean {
  if (msg.oneTimeView && msg.isRead) {
    if (!msg.readAt) return true
    const timeSinceRead = Date.now() - new Date(msg.readAt).getTime()
    // Retain for 15 seconds after recipient reads it once, then self-destruct
    return timeSinceRead > 15 * 1000
  }
  if (!msg.selfDestruct) return false
  const age = Date.now() - new Date(msg.createdAt).getTime()
  return age > 24 * 60 * 60 * 1000
}

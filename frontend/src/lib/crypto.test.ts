import { describe, it, expect } from "vitest"
import { generateAESKey, exportCryptoKey, importCryptoKey } from "./crypto"

describe("Frontend WebCrypto Utility (src/lib/crypto.ts)", () => {
  it("should generate, export, and import AES-GCM crypto keys", async () => {
    const key = await generateAESKey("AES-GCM")
    expect(key).toBeDefined()
    expect(key.type).toBe("secret")

    const exportedStr = await exportCryptoKey(key)
    expect(typeof exportedStr).toBe("string")
    expect(exportedStr.length).toBeGreaterThan(0)

    const importedKey = await importCryptoKey(exportedStr, "AES-GCM")
    expect(importedKey).toBeDefined()
    expect(importedKey.algorithm.name).toBe("AES-GCM")
  })
})

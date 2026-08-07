import { test, expect, type Page } from "@playwright/test"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const TEST_EMAIL = "jordan.case@stegshield.test"
const TEST_PASSWORD = "password"

async function pause(ms = 1200) {
  return new Promise((r) => setTimeout(r, ms))
}

async function safeClick(page: Page, selector: string, opts?: { timeout?: number }) {
  try {
    const el = page.locator(selector).first()
    if (await el.isVisible({ timeout: opts?.timeout ?? 5000 })) {
      await el.click()
      await pause()
    }
  } catch (e) {
    // Ignore click failures
  }
}

async function safeFill(page: Page, selector: string, value: string) {
  try {
    const el = page.locator(selector).first()
    if (await el.isVisible({ timeout: 5000 })) {
      await el.fill(value)
      await pause(500)
    }
  } catch (e) {
    // Ignore fill failures
  }
}

async function safeGoto(page: Page, path: string) {
  try {
    await page.goto(`${BASE}${path}`, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await pause(2000)
  } catch (e) {
    console.log(`Navigation note for ${path}:`, e)
  }
}

test("full feature walkthrough for video recording", async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  // ------------------ LOGIN ------------------
  try {
    await page.goto(`${BASE}/login`, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await pause(1500)
    await safeFill(page, 'input[type="email"], input[name="email"]', TEST_EMAIL)
    await safeFill(page, 'input[type="password"], input[name="password"]', TEST_PASSWORD)
    await safeClick(page, 'button[type="submit"]')
    await pause(2000)
  } catch (e) {
    console.log("Login flow bypass note:", e)
  }

  // ------------------ DASHBOARD ------------------
  await safeGoto(page, "/dashboard")

  // ------------------ SECURE MESSAGING ------------------
  await safeGoto(page, "/secure-messaging")
  await safeClick(page, 'button:has-text("Discover"), button:has-text("Search")')
  await safeFill(page, 'input[placeholder*="Search"], input[placeholder*="search"]', "Jordan")
  await pause(1000)

  // ------------------ FILE ENCRYPTION ------------------
  await safeGoto(page, "/file-encryption")
  try {
    const fileInput = page.locator('input[type="file"]').first()
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles({
        name: "demo.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("StegShield X demo content"),
      })
      await pause(1500)
    }
  } catch (e) {}
  await safeClick(page, 'button:has-text("Encrypt"), button:has-text("Generate Key")')

  // ------------------ EVIDENCE VAULT ------------------
  await safeGoto(page, "/evidence-vault")
  await safeClick(page, 'button:has-text("Upload"), button:has-text("Add Evidence")')

  // ------------------ STEGANOGRAPHY ------------------
  await safeGoto(page, "/steganography")
  try {
    const stegoInput = page.locator('input[type="file"]').first()
    if (await stegoInput.count() > 0) {
      await stegoInput.setInputFiles({
        name: "cover.png",
        mimeType: "image/png",
        buffer: Buffer.from("PNG"),
      })
      await pause(1500)
    }
  } catch (e) {}
  await safeClick(page, 'button:has-text("Encode"), button:has-text("Hide Message")')

  // ------------------ DIGITAL FORENSICS ------------------
  await safeGoto(page, "/digital-forensics")
  await safeClick(page, 'button:has-text("Analyze"), button:has-text("Scan")')

  // ------------------ TAMPER DETECTION ------------------
  await safeGoto(page, "/tamper-detection")
  await safeClick(page, 'button:has-text("Check"), button:has-text("Analyze")')

  // ------------------ WATERMARKING ------------------
  await safeGoto(page, "/watermarking")
  await safeClick(page, 'button:has-text("Watermark"), button:has-text("Embed")')

  // ------------------ METADATA ANALYSIS ------------------
  await safeGoto(page, "/metadata")
  await safeClick(page, 'button:has-text("Analyze"), button:has-text("Extract")')

  // ------------------ API PLATFORM ------------------
  await safeGoto(page, "/api-platform")
  await safeClick(page, 'button:has-text("Create API Key"), button:has-text("New Key")')

  // ------------------ SETTINGS ------------------
  await safeGoto(page, "/settings")
  for (const tab of ["Profile", "Security", "Notifications", "Appearance", "Privacy"]) {
    await safeClick(page, `button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`)
    await pause(600)
  }

  // ------------------ ADMIN PANEL ------------------
  await safeGoto(page, "/admin-panel")

  // ------------------ WRAP UP ------------------
  await safeGoto(page, "/dashboard")
  await pause(2000)
})


import { describe, it, expect } from "vitest"
import { isSelfDestructed } from "./message-crypto"

describe("message-crypto self-destruct logic", () => {
  it("should return false for normal active messages", () => {
    const activeMsg = {
      selfDestruct: false,
      oneTimeView: false,
      createdAt: new Date().toISOString(),
    }
    expect(isSelfDestructed(activeMsg)).toBe(false)
  })

  it("should return true for selfDestruct messages older than expiry", () => {
    const expiredTime = new Date(Date.now() - 25 * 3600 * 1000).toISOString() // 25 hours ago
    const expiredMsg = {
      selfDestruct: true,
      createdAt: expiredTime,
    }
    expect(isSelfDestructed(expiredMsg)).toBe(true)
  })

  it("should handle oneTimeView messages after 15s delay", () => {
    const recentlyRead = new Date(Date.now() - 5 * 1000).toISOString() // 5s ago
    const oneTimeMsgRecentlyRead = {
      oneTimeView: true,
      isRead: true,
      readAt: recentlyRead,
      createdAt: new Date().toISOString(),
    }
    expect(isSelfDestructed(oneTimeMsgRecentlyRead)).toBe(false)

    const readLongAgo = new Date(Date.now() - 20 * 1000).toISOString() // 20s ago
    const oneTimeMsgReadLongAgo = {
      oneTimeView: true,
      isRead: true,
      readAt: readLongAgo,
      createdAt: new Date().toISOString(),
    }
    expect(isSelfDestructed(oneTimeMsgReadLongAgo)).toBe(true)
  })
})

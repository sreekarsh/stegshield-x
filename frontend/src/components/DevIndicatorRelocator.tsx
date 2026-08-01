"use client"

import { useEffect } from "react"

export function DevIndicatorRelocator() {
  useEffect(() => {
    const relocate = () => {
      const portals = document.querySelectorAll("nextjs-portal, #nextjs-dev-tools")
      portals.forEach((el) => {
        const htmlEl = el as HTMLElement
        htmlEl.style.setProperty("left", "auto", "important")
        htmlEl.style.setProperty("right", "16px", "important")
        htmlEl.style.setProperty("bottom", "16px", "important")

        if (htmlEl.shadowRoot) {
          const oldStyle = htmlEl.shadowRoot.querySelector("#nextjs-right-mover")
          if (oldStyle) oldStyle.remove()

          const style = document.createElement("style")
          style.id = "nextjs-right-mover"
          style.textContent = `
            :host > [data-nextjs-toast-wrapper],
            :host > div[class*="toast-wrapper"],
            :host > button {
              left: auto !important;
              right: 16px !important;
              bottom: 16px !important;
            }
          `
          htmlEl.shadowRoot.appendChild(style)
        }
      })
    }

    relocate()
    const interval = setInterval(relocate, 500)
    const observer = new MutationObserver(relocate)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearInterval(interval)
      observer.disconnect()
    }
  }, [])

  return null
}

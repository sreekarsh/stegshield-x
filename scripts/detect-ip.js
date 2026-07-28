const os = require("os")

const interfaces = os.networkInterfaces()
const results = []

for (const [name, addrs] of Object.entries(interfaces)) {
  if (!addrs) continue
  for (const addr of addrs) {
    if (addr.family === "IPv4" && !addr.internal) {
      results.push({
        name,
        address: addr.address,
        mac: addr.mac,
      })
    }
  }
}

results.sort((a, b) => {
  if (a.name.startsWith("eth") || a.name.startsWith("en")) return -1
  if (b.name.startsWith("eth") || b.name.startsWith("en")) return 1
  if (a.name.startsWith("wl")) return -1
  if (b.name.startsWith("wl")) return 1
  return 0
})

const ip = results.length > 0 ? results[0].address : "127.0.0.1"

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ip, interfaces: results }))
} else {
  console.log(ip)
}

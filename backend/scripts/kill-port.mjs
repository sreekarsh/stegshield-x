import { execSync } from "child_process"

const port = process.argv[2]
if (!port) process.exit(0)

try {
  const stdout = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })
  for (const line of stdout.split("\n")) {
    const m = line.match(/LISTENING\s+(\d+)/)
    if (m) {
      try { process.kill(+m[1]) } catch {}
    }
  }
} catch {}

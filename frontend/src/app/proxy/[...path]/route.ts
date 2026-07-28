export const dynamic = "force-dynamic"

const BACKEND = process.env.API_PROXY_TARGET || "http://localhost:4000"

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const query = new URL(req.url).search
  const target = `${BACKEND}/api/${path.join("/")}${query}`

  const res = await fetch(target)

  const contentType = res.headers.get("content-type") || "application/json"
  const body = contentType.includes("json") ? await res.text() : await res.blob()

  return new Response(body, {
    status: res.status,
    headers: { "content-type": contentType },
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const query = new URL(req.url).search
  const target = `${BACKEND}/api/${path.join("/")}${query}`

  const bodyText = await req.text()
  const res = await fetch(target, {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") || "application/json" },
    body: bodyText || undefined,
  })

  const contentType = res.headers.get("content-type") || "application/json"
  const body = contentType.includes("json") ? await res.text() : await res.blob()

  return new Response(body, {
    status: res.status,
    headers: { "content-type": contentType },
  })
}

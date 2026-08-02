import { Injectable, Logger } from "@nestjs/common"
import { HttpService } from "@nestjs/axios"
import { firstValueFrom } from "rxjs"
import * as crypto from "crypto"

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  endpoint: string
  region: string
}

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name)
  private readonly config: R2Config | null = null

  constructor(private readonly http: HttpService) {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET_NAME || "stegshield-evidence"
    const endpoint = process.env.R2_ENDPOINT
    const region = process.env.R2_REGION || "auto"

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn("R2 not fully configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
      return
    }

    this.config = { accountId: accountId || "", accessKeyId, secretAccessKey, bucket, endpoint, region }
  }

  get isConfigured(): boolean {
    return !!this.config && !!this.config.endpoint
  }

  private signRequest(method: string, key: string, body: Buffer | null = null): { url: string; headers: Record<string, string> } {
    if (!this.config) throw new Error("R2 not configured")

    const host = new URL(this.config.endpoint).host
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "")
    const date = now.toUTCString()
    const payloadHash = crypto.createHash("sha256").update(body || Buffer.alloc(0)).digest("hex")

    const headersToSign: Record<string, string> = {
      host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    }

    const signedHeaderNames = Object.keys(headersToSign).sort().join(";")

    const canonicalURI = `/${this.config.bucket}/${key}`
    const canonicalQueryString = ""
    const canonicalHeaders = Object.keys(headersToSign).sort().map(k => `${k}:${headersToSign[k]}\n`).join("")
    const canonicalRequest = `${method}\n${canonicalURI}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaderNames}\n${payloadHash}`

    const algorithm = "AWS4-HMAC-SHA256"
    const credentialScope = `${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}/s3/aws4_request`
    const canonicalRequestHash = crypto.createHash("sha256").update(canonicalRequest).digest("hex")
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`

    const signingKey = crypto.createHmac("sha256", `AWS4${this.config.secretAccessKey}`)
      .update(date.slice(0, 4))
      .digest()
    const signingKey2 = crypto.createHmac("sha256", signingKey).update(date.slice(5, 7)).digest()
    const signingKey3 = crypto.createHmac("sha256", signingKey2).update(date.slice(8, 10)).digest()
    const signingKey4 = crypto.createHmac("sha256", signingKey3).update("s3/aws4_request").digest()
    const signature = crypto.createHmac("sha256", signingKey4).update(stringToSign).digest("hex")

    const authorization = `${algorithm} Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`

    const url = `${this.config.endpoint}/${this.config.bucket}/${key}`
    const headers: Record<string, string> = {
      ...headersToSign,
      Authorization: authorization,
    }
    return { url, headers }
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    if (!this.isConfigured) throw new Error("R2 not configured")
    const { url, headers } = this.signRequest("PUT", key, data)
    const allHeaders = { ...headers, "Content-Type": contentType || "application/octet-stream" }
    const response = await firstValueFrom(
      this.http.put(url, data, { headers: allHeaders, responseType: "text" }),
    )
    if (response.status >= 400) {
      throw new Error(`R2 upload failed: ${response.status} ${response.data}`)
    }
    return key
  }

  async download(key: string): Promise<Buffer> {
    if (!this.isConfigured) throw new Error("R2 not configured")
    const { url, headers } = this.signRequest("GET", key)
    const response = await firstValueFrom(
      this.http.get(url, { headers, responseType: "text" }),
    )
    if (response.status >= 400) {
      throw new Error(`R2 download failed: ${response.status} ${response.data}`)
    }
    return Buffer.from(response.data as string)
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured) return
    const { url, headers } = this.signRequest("DELETE", key)
    try {
      await firstValueFrom(this.http.delete(url, { headers, responseType: "text" }))
    } catch {}
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.isConfigured) return ""
    const expires = Math.floor(Date.now() / 1000) + expiresIn
    const host = new URL(this.config!.endpoint).host
    const now = new Date()
    const date = now.toUTCString()
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "")
    const credentialScope = `${date.slice(0, 4)}/${date.slice(5, 7)}/${date.slice(8, 10)}/s3/aws4_request`
    const url = `${this.config!.endpoint}/${this.config!.bucket}/${key}`
    const signingKey = crypto.createHmac("sha256", `AWS4${this.config!.secretAccessKey}`)
      .update(date.slice(0, 4))
      .digest()
    const signingKey2 = crypto.createHmac("sha256", signingKey).update(date.slice(5, 7)).digest()
    const signingKey3 = crypto.createHmac("sha256", signingKey2).update(date.slice(8, 10)).digest()
    const signingKey4 = crypto.createHmac("sha256", signingKey3).update("s3/aws4_request").digest()
    const params = new URLSearchParams({
      "X-Amz-Expires": String(expiresIn),
      "X-Amz-SignedHeaders": "host;x-amz-date;x-amz-content-sha256",
      "X-Amz-Date": amzDate,
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.config!.accessKeyId}/${credentialScope}`,
    })
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(params.toString()).digest("hex")}`
    const signature = crypto.createHmac("sha256", signingKey4).update(stringToSign).digest("hex")
    return `${url}?${params.toString()}&X-Amz-Signature=${signature}`
  }
}

import { Injectable, Logger } from "@nestjs/common"

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
  private s3Client: any = null

  constructor() {
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

  private async getClient(): Promise<any> {
    if (!this.isConfigured) throw new Error("R2 not configured")
    if (!this.s3Client) {
      const { S3Client } = await import("@aws-sdk/client-s3")
      this.s3Client = new S3Client({
        region: this.config!.region,
        endpoint: this.config!.endpoint,
        credentials: { accessKeyId: this.config!.accessKeyId, secretAccessKey: this.config!.secretAccessKey },
        forcePathStyle: true,
      })
    }
    return this.s3Client
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    const client = await this.getClient()
    const { PutObjectCommand } = await import("@aws-sdk/client-s3")
    const command = new PutObjectCommand({
      Bucket: this.config!.bucket,
      Key: key,
      Body: data,
      ContentType: contentType || "application/octet-stream",
    })
    await client.send(command)
    return key
  }

  async download(key: string): Promise<Buffer> {
    const client = await this.getClient()
    const { GetObjectCommand } = await import("@aws-sdk/client-s3")
    const command = new GetObjectCommand({ Bucket: this.config!.bucket, Key: key })
    const response = await client.send(command)
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured) return
    const client = await this.getClient()
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const command = new DeleteObjectCommand({ Bucket: this.config!.bucket, Key: key })
    await client.send(command)
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.isConfigured) return ""
    const client = await this.getClient()
    const { GetObjectCommand } = await import("@aws-sdk/client-s3")
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
    const command = new GetObjectCommand({ Bucket: this.config!.bucket, Key: key })
    return getSignedUrl(client, command, { expiresIn })
  }
}

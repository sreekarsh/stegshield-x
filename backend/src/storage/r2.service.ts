import { Injectable, Logger } from "@nestjs/common"
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name)
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || "stegshield-evidence"
    const endpoint = process.env.R2_ENDPOINT
    const region = process.env.R2_REGION || "auto"
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn("R2 not fully configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
      this.client = null as any
      return
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })
  }

  get isConfigured(): boolean {
    return !!this.client
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<string> {
    if (!this.isConfigured) throw new Error("R2 not configured")
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType || "application/octet-stream",
    })
    await this.client.send(command)
    return key
  }

  async download(key: string): Promise<Buffer> {
    if (!this.isConfigured) throw new Error("R2 not configured")
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    const response = await this.client.send(command)
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured) return
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    await this.client.send(command)
  }

  getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.isConfigured) return Promise.resolve("")
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn })
  }
}

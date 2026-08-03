declare module "speakeasy" {
  export interface GenerateSecretOptions {
    name?: string
    issuer?: string
  }

  export interface GenerateSecretResult {
    base32: string
    otpauth_url: string
  }

  export interface TotpVerifyOptions {
    secret: string
    encoding?: string
    token: string
    window?: number
  }

  export const totp: {
    verify(options: TotpVerifyOptions): boolean
    generateSecret(options?: GenerateSecretOptions): GenerateSecretResult
  }
}

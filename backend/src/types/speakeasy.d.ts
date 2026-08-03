declare module "speakeasy" {
  export interface GenerateSecretOptions {
    name?: string
    issuer?: string
  }

  export interface GenerateSecretResult {
    ascii: string
    hex: string
    base32: string
    otpauth_url: string
  }

  export interface TotpVerifyOptions {
    secret: string
    encoding?: string
    token: string
    window?: number
  }

  export interface TotpVerifyDeltaOptions extends TotpVerifyOptions {
    counter?: number
    step?: number
  }

  export interface HotpOptions {
    secret: string
    counter: number
    encoding?: string
  }

  export interface HotpVerifyDeltaOptions extends HotpOptions {
    window?: number
  }

  export const generateSecret: (options?: GenerateSecretOptions) => GenerateSecretResult

  export const totp: {
    generateSecret(options?: GenerateSecretOptions): GenerateSecretResult
    verify(options: TotpVerifyOptions): boolean
    verifyDelta(options: TotpVerifyDeltaOptions): { delta: number } | null
    options(options: { encoding: string; digits?: number }): any
  }

  export const hotp: {
    generate(options: HotpOptions): { hex: string; base32: string; otpauth_url: string }
    verify(options: HotpOptions): boolean
    verifyDelta(options: HotpVerifyDeltaOptions): { delta: number } | null
  }

  export const counter: {
    now(counter?: number): number
  }

  export const time: {
    residualTime(step?: number): number
  }
}

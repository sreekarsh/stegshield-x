declare module "speakeasy" {
  export interface TotpVerifyOptions {
    secret: string
    encoding?: string
    token: string
    window?: number
  }

  export const totp: {
    verify(options: TotpVerifyOptions): boolean
  }
}

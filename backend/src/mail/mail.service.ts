import { Injectable } from "@nestjs/common"
import * as nodemailer from "nodemailer"

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    const host = process.env.SMTP_HOST
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || "",
        },
      })
    }
  }

  async sendInvitation(options: {
    to: string
    invitedByName: string
    organizationName: string
    role: string
    acceptUrl: string
    declineUrl: string
  }) {
    if (!this.transporter) return

    const { to, invitedByName, organizationName, role, acceptUrl, declineUrl } = options
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = `You're invited to join ${organizationName} on StegShield X`

    const html = this.buildTemplate({ invitedByName, organizationName, role, acceptUrl, declineUrl })
    const text = `${invitedByName} has invited you to join ${organizationName} on StegShield X as ${role}.\n\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`

    await this.transporter.sendMail({
      from: `"${invitedByName} via StegShield X" <${from}>`,
      replyTo: process.env.SMTP_USER || "",
      to,
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${acceptUrl}?unsubscribe=1>`,
        "Precedence": "bulk",
        "X-Mailer": "StegShield X",
      },
    })
  }

  async sendPasswordChanged(to: string, userName: string) {
    if (!this.transporter) return
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    try {
      await this.transporter.sendMail({
        from: `"StegShield X Security" <${from}>`,
        to,
        subject: "StegShield X — Your password was changed",
        text: `Hi ${userName},\n\nYour StegShield X password was successfully changed.\n\nIf you did not make this change, contact your administrator immediately.\n\n— StegShield X Security`,
        html: `<p>Hi ${userName},</p><p>Your StegShield X password was successfully changed.</p><p>If you did not make this change, contact your administrator immediately.</p><p>— StegShield X Security</p>`,
      })
    } catch (err) {
      console.error("Failed to send password changed alert:", err)
    }
  }

  async sendPanicAlert(opts: { to: string; userName: string; action: string; ip: string }) {
    if (!this.transporter) return

    const { to, userName, action, ip } = opts
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const actionLabels: Record<string, string> = {
      destroy_keys: "Destroy Encryption Keys",
      logout_all: "Logout All Devices",
      revoke_tokens: "Revoke All API Tokens",
      clear_audit: "Clear Audit Logs",
    }
    const label = actionLabels[action] || action
    const subject = `[SECURITY ALERT] Panic Mode Triggered — ${label}`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:480px){.container{width:100%!important}.inner{padding:24px 16px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table class="container" width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:32px 32px 24px;text-align:center">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">Security Alert</h1>
    <p style="margin:4px 0 0;color:#fca5a5;font-size:13px">Panic Mode was triggered on your account</p>
  </td></tr>
  <tr><td class="inner" style="padding:32px 32px 8px">
    <p style="font-size:14px;color:#64748b;margin:0 0 16px">Hi ${userName},</p>
    <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 16px">
      A panic mode action was triggered on your StegShield X account:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0" cellpadding="8">
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:100px">Action</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600">${label}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">IP Address</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${ip}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Time</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${new Date().toLocaleString()}</td></tr>
    </table>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:16px 0 0">
      If you did not perform this action, change your password immediately and contact support at <a href="mailto:security@stegshield.com" style="color:#6366f1">security@stegshield.com</a>.
    </p>
  </td></tr>
  <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9">
    <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.5">This is an automated security notification from StegShield X. If you need further assistance, please reply to this email or contact your administrator.</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`

    const text = `SECURITY ALERT — Panic Mode Triggered\n\nAction: ${label}\nIP: ${ip}\nTime: ${new Date().toLocaleString()}\n\nIf you did not perform this action, change your password immediately and contact security@stegshield.com.`

    try {
      await this.transporter.sendMail({
        from: `"StegShield X Security" <${from}>`,
        to,
        subject,
        text,
        html,
        headers: {
          Priority: "urgent",
          Importance: "high",
          "X-Mailer": "StegShield X",
        },
      })
    } catch (err) {
      console.error("Failed to send panic alert email:", err)
    }
  }

  async sendEmailChangedNotification(to: string, userName: string, newEmail: string) {
    if (!this.transporter) return
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    try {
      await this.transporter.sendMail({
        from: `"StegShield X Security" <${from}>`,
        to,
        subject: "StegShield X — Your email address was changed",
        text: `Hi ${userName},\n\nYour StegShield X email address was changed to ${newEmail}.\n\nIf you did not make this change, contact your administrator immediately.\n\n— StegShield X Security`,
        html: `<p>Hi ${userName},</p><p>Your StegShield X email address was changed to <strong>${newEmail}</strong>.</p><p>If you did not make this change, contact your administrator immediately.</p><p>— StegShield X Security</p>`,
      })
    } catch (err) {
      console.error("Failed to send email change notification:", err)
    }
  }

  private buildTemplate(opts: { invitedByName: string; organizationName: string; role: string; acceptUrl: string; declineUrl: string }) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:480px){.container{width:100%!important}.inner{padding:24px 16px!important}.btn{display:block!important;width:100%!important;text-align:center!important;margin-bottom:8px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table class="container" width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 24px;text-align:center">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">StegShield X</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Secure your digital world</p>
  </td></tr>
  <tr><td class="inner" style="padding:32px 32px 8px">
    <p style="font-size:14px;color:#64748b;margin:0 0 16px">Hello,</p>
    <p style="font-size:15px;color:#334155;line-height:1.6;margin:0 0 16px">
      <strong style="color:#0f172a">${opts.invitedByName}</strong> has invited you to join the organization
      <strong style="color:#0f172a">${opts.organizationName}</strong> on StegShield X with the role of
      <strong style="color:#6366f1">${opts.role}</strong>.
    </p>
  </td></tr>
  <tr><td style="padding:8px 32px 24px">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:0 8px 0 0">
          <a href="${opts.acceptUrl}" class="btn" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;white-space:nowrap">Accept Invitation</a>
        </td>
        <td style="padding:0 0 0 8px">
          <a href="${opts.declineUrl}" class="btn" style="display:inline-block;padding:12px 28px;background:#f8fafc;color:#64748b;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;border:1px solid #e2e8f0;white-space:nowrap">Decline</a>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9">
    <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;line-height:1.5">
      If you were not expecting this invitation, you can safely ignore this email. Only invited users will be added to the organization.
    </p>
    <p style="font-size:12px;color:#cbd5e1;margin:8px 0 0">&copy; 2026 StegShield X &mdash; All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`
  }
}

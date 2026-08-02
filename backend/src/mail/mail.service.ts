import { Injectable, Logger } from "@nestjs/common"

interface MailOptions {
  to: string
  from?: string
  replyTo?: string
  subject: string
  text?: string
  html?: string
  headers?: Record<string, string>
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly securityContact: string
  private readonly resendApiKey: string | null
  private readonly smtpFrom: string

  constructor() {
    this.securityContact = process.env.SECURITY_CONTACT_EMAIL || "security@stegshield.com"
    this.resendApiKey = process.env.RESEND_API_KEY || null
    this.smtpFrom = process.env.SMTP_FROM || "noreply@stegshield.com"
  }

  private async sendViaResend(opts: MailOptions): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.resendApiKey}`,
      },
      body: JSON.stringify({
        from: opts.from || `StegShield X <${this.smtpFrom}>`,
        to: [opts.to],
        reply_to: opts.replyTo,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        headers: opts.headers,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error")
      throw new Error(`Resend API error ${res.status}: ${errText}`)
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
    const { to, invitedByName, organizationName, role, acceptUrl, declineUrl } = options
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = `You're invited to join ${organizationName} on StegShield X`

    const html = this.buildTemplate({ invitedByName, organizationName, role, acceptUrl, declineUrl })
    const text = `${invitedByName} has invited you to join ${organizationName} on StegShield X as ${role}.\n\nAccept: ${acceptUrl}\nDecline: ${declineUrl}`

    if (this.resendApiKey) {
      return this.sendViaResend({
        to,
        from: `"${invitedByName} via StegShield X" <${from}>`,
        replyTo: process.env.SMTP_USER || from,
        subject,
        text,
        html,
      }).catch((err) => this.logger.error("Failed to send invitation email via Resend:", err))
    }

    this.logger.warn("No RESEND_API_KEY configured — invitation email not sent")
  }

  async sendPasswordChanged(to: string, userName: string) {
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = "StegShield X — Your password was changed"
    const text = `Hi ${userName},\n\nYour StegShield X password was successfully changed.\n\nIf you did not make this change, contact your administrator immediately.\n\n— StegShield X Security`
    const html = `<p>Hi ${userName},</p><p>Your StegShield X password was successfully changed.</p><p>If you did not make this change, contact your administrator immediately.</p><p>— StegShield X Security</p>`

    if (this.resendApiKey) {
      return this.sendViaResend({ to, from: `"StegShield X Security" <${from}>`, subject, text, html }).catch((err) => this.logger.error("Failed to send password changed alert via Resend:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — password changed email not sent")
  }

  async sendPanicAlert(opts: { to: string; userName: string; action: string; ip: string }) {
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
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
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
      If you did not perform this action, change your password immediately and contact support at <a href="mailto:${this.securityContact}" style="color:#6366f1">${this.securityContact}</a>.
    </p>
  </td></tr>
  <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9">
    <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.5">This is an automated security notification from StegShield X. If you need further assistance, please reply to this email or contact your administrator.</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`

    const text = `SECURITY ALERT — Panic Mode Triggered\n\nAction: ${label}\nIP: ${ip}\nTime: ${new Date().toLocaleString()}\n\nIf you did not perform this action, change your password immediately and contact ${this.securityContact}.`

    if (this.resendApiKey) {
      return this.sendViaResend({
        to,
        from: `"StegShield X Security" <${from}>`,
        subject,
        text,
        html,
        headers: { Priority: "urgent", Importance: "high", "X-Mailer": "StegShield X" },
      }).catch((err) => this.logger.error("Failed to send panic alert via Resend:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — panic alert email not sent")
  }

  async sendSecurityReport(opts: { fromEmail: string; userName: string; message: string; ip?: string }) {
    const { fromEmail, userName, message, ip } = opts
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = "[SECURITY INCIDENT] Panic Mode Report"
    const safeMessage = this.escapeHtml(message)

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:480px){.container{width:100%!important}.inner{padding:24px 16px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table class="container" width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:32px 32px 24px;text-align:center">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">Security Incident Report</h1>
    <p style="margin:4px 0 0;color:#fca5a5;font-size:13px">A user contacted the security team from Panic Mode</p>
  </td></tr>
  <tr><td class="inner" style="padding:32px 32px 8px">
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px" cellpadding="8">
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:100px">User</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600">${userName}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Email</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${fromEmail}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">IP Address</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${ip || "Unknown"}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Time</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${new Date().toLocaleString()}</td></tr>
    </table>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 8px"><strong>Message:</strong></p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;margin:0">${safeMessage}</div>
  </td></tr>
  <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9">
    <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.5">This report was submitted from Panic Mode on StegShield X. Reply directly to ${fromEmail} to contact the user.</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`

    const text = `SECURITY INCIDENT REPORT (Panic Mode)\n\nUser: ${userName}\nEmail: ${fromEmail}\nIP: ${ip || "Unknown"}\nTime: ${new Date().toLocaleString()}\n\nMessage:\n${message}`

    if (this.resendApiKey) {
      return this.sendViaResend({
        from: `"StegShield X Security" <${from}>`,
        to: this.securityContact,
        replyTo: fromEmail,
        subject,
        text,
        html,
        headers: { Priority: "urgent", Importance: "high", "X-Mailer": "StegShield X" },
      }).catch((err) => this.logger.error("Failed to send security report via Resend:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — security report email not sent")
  }

  async sendSupportRequest(opts: { fromEmail: string; userName: string; message: string; ip?: string; category?: string }) {
    const { fromEmail, userName, message, ip, category } = opts
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = `[SUPPORT REQUEST]${category ? ` ${category} -` : ""} ${userName}`
    const safeMessage = this.escapeHtml(message)

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:480px){.container{width:100%!important}.inner{padding:24px 16px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table class="container" width="480" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 24px;text-align:center">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">Support Request</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">A user reported an issue from the Help Center</p>
  </td></tr>
  <tr><td class="inner" style="padding:32px 32px 8px">
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px" cellpadding="8">
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b;width:100px">User</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600">${userName}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Email</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${fromEmail}</td></tr>
      ${category ? `<tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Category</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${this.escapeHtml(category)}</td></tr>` : ""}
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">IP Address</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${ip || "Unknown"}</td></tr>
      <tr><td style="border:1px solid #e2e8f0;font-size:13px;color:#64748b">Time</td><td style="border:1px solid #e2e8f0;font-size:14px;color:#0f172a">${new Date().toLocaleString()}</td></tr>
    </table>
    <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 8px"><strong>Message:</strong></p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;margin:0">${safeMessage}</div>
  </td></tr>
  <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9">
    <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.5">This request was submitted from the Help Center on StegShield X. Reply directly to ${fromEmail} to contact the user.</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`

    const text = `SUPPORT REQUEST\n\nUser: ${userName}\nEmail: ${fromEmail}${category ? `\nCategory: ${category}` : ""}\nIP: ${ip || "Unknown"}\nTime: ${new Date().toLocaleString()}\n\nMessage:\n${message}`

    if (this.resendApiKey) {
      return this.sendViaResend({
        from: `"StegShield X Support" <${from}>`,
        to: this.securityContact,
        replyTo: fromEmail,
        subject,
        text,
        html,
        headers: { Priority: "high", "X-Mailer": "StegShield X" },
      }).catch((err) => this.logger.error("Failed to send support request via Resend:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — support request email not sent")
  }

  async sendEmailChangedNotification(to: string, userName: string, newEmail: string) {
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const subject = "StegShield X — Your email address was changed"
    const text = `Hi ${userName},\n\nYour StegShield X email address was changed to ${newEmail}.\n\nIf you did not make this change, contact your administrator immediately.\n\n— StegShield X Security`
    const html = `<p>Hi ${userName},</p><p>Your StegShield X email address was changed to <strong>${newEmail}</strong>.</p><p>If you did not make this change, contact your administrator immediately.</p><p>— StegShield X Security</p>`

    if (this.resendApiKey) {
      return this.sendViaResend({ to, from: `"StegShield X Security" <${from}>`, subject, text, html }).catch((err) => this.logger.error("Failed to send email change notification via Resend:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — email change notification not sent")
  }

  async sendPasswordReset(userEmail: string, resetToken: string, appUrl: string) {
    const from = process.env.SMTP_FROM || "noreply@stegshield.com"
    const recipient = this.securityContact
    const subject = `[Password Reset Request] ${userEmail}`
    const resetLink = `${appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(userEmail)}`
    const text = `Password Reset Request\n\nUser Email: ${userEmail}\nReset Token: ${resetToken}\nReset Link: ${resetLink}\n\nThis token expires in 1 hour. Forward the reset link to the user.`
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table width="540" cellpadding="0" cellspacing="0" role="presentation" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px;text-align:center">
    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff">Password Reset Request</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;font-weight:500">Forward this reset link to the user</p>
  </td></tr>
  <tr><td style="padding:28px 28px 16px;color:#cbd5e1;font-size:14px;line-height:1.6">
    <p style="margin:0 0 12px">A user requested a password reset:</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px" cellpadding="8">
      <tr><td style="border:1px solid #334155;font-size:13px;color:#94a3b8;width:100px">User Email</td><td style="border:1px solid #334155;font-size:14px;color:#ffffff;font-weight:600">${userEmail}</td></tr>
    </table>
    <div style="background:#090d16;border:1px solid #3b82f6;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700">Reset Token (1-Hour Validity)</p>
      <code style="display:block;font-family:monospace;font-size:12px;color:#38bdf8;word-break:break-all;line-height:1.5;background:#030712;padding:10px;border-radius:6px;border:1px solid #1e293b">${resetToken}</code>
    </div>
    <p style="margin:20px 0 8px;font-size:13px;color:#94a3b8;font-weight:600">Reset Link to Forward:</p>
    <a href="${resetLink}" style="display:block;padding:14px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;text-align:center">${resetLink}</a>
    <p style="margin:20px 0 0;font-size:12px;color:#64748b">This token expires in 1 hour. Forward the link above to ${userEmail}.</p>
  </td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #334155;text-align:center">
    <p style="font-size:11px;color:#64748b;margin:0">&copy; 2026 StegShield X &mdash; Zero Trust Security System</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`

    if (this.resendApiKey) {
      return this.sendViaResend({ to: recipient, from: `"StegShield X Admin" <${from}>`, subject, text, html }).catch((err) => this.logger.error("Failed to send password reset to admin:", err))
    }
    this.logger.warn("No RESEND_API_KEY configured — password reset email not sent")
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  private buildTemplate(opts: { invitedByName: string; organizationName: string; role: string; acceptUrl: string; declineUrl: string }) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @media only screen and (max-width:480px){.container{width:100%!important}.inner{padding:24px 16px!important}.btn{display:block!important;width:100%!important;text-align:center!important;margin-bottom:8px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
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

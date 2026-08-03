export const AuditActions = {
  // Auth
  AUTH_REGISTER: "auth.register",
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_PASSWORD_CHANGE: "auth.password.change",
  AUTH_MFA_SETUP: "auth.mfa.setup",
  AUTH_MFA_VERIFY: "auth.mfa.verify",
  AUTH_MFA_CHALLENGE: "auth.mfa.challenge",
  AUTH_MFA_DISABLE: "auth.mfa.disable",
  AUTH_OAUTH_LOGIN: "auth.oauth.login",
  AUTH_TOKEN_REFRESH: "auth.token.refresh",
  AUTH_PASSWORD_FORGOT: "auth.password.forgot",
  AUTH_PASSWORD_RESET: "auth.password.reset",
  AUTH_OAUTH_DISCONNECT: "auth.oauth.disconnect",

  // Sharing
  SHARE_LINK_CREATE: "share.link.create",
  SHARE_LINK_ACCESS: "share.link.access",
  SHARE_LINK_VERIFY: "share.link.verify",
  SHARE_LINK_DELETE: "share.link.delete",

  // Evidence
  EVIDENCE_UPLOAD: "evidence.upload",
  EVIDENCE_DOWNLOAD: "evidence.download",
  EVIDENCE_STATUS_CHANGE: "evidence.status.change",
  EVIDENCE_UPDATE: "evidence.update",
  EVIDENCE_DELETE: "evidence.delete",
  EVIDENCE_ARCHIVE: "evidence.archive",

  // Watermark
  WATERMARK_INVISIBLE_EMBED: "watermark.invisible.embed",
  WATERMARK_VISIBLE_EMBED: "watermark.visible.embed",
  WATERMARK_DELETE: "watermark.delete",

  // Panic
  PANIC_DESTROY_KEYS: "panic.destroy.keys",
  PANIC_LOGOUT_ALL: "panic.logout.all",
  PANIC_REVOKE_TOKENS: "panic.revoke.tokens",
  PANIC_CLEAR_AUDIT: "panic.clear.audit",

  // Team
  TEAM_INVITE_PENDING: "team.invite.pending",
  TEAM_INVITE_ADDED: "team.invite.added",
  TEAM_INVITE_ACCEPTED: "team.invite.accepted",
  TEAM_INVITE_DECLINED: "team.invite.declined",
  TEAM_MEMBER_REMOVED: "team.member.removed",
  TEAM_MEMBER_ROLE_CHANGED: "team.member.role.changed",
  TEAM_MEMBER_LEFT: "team.member.left",

  // User
  USER_DELETED: "user.deleted",
  USER_EMAIL_CHANGED: "user.email.changed",
  USER_EXPORT_DATA: "user.export.data",
  USER_SETTINGS_UPDATED: "user.settings.updated",

  // Admin
  ADMIN_BROADCAST: "admin.broadcast",
} as const

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions]

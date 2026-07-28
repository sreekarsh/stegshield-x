import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"
import * as crypto from "crypto"
import { Role } from "@prisma/client"
import { sanitizeIp } from "../common/utils"

const VALID_ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"]
const INVITATION_DAYS_VALID = 7

function parseRole(role: string): Role {
  if (!VALID_ROLES.includes(role as Role)) throw new BadRequestException(`Invalid role: ${role}`)
  return role as Role
}

function isExpired(createdAt: Date): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - INVITATION_DAYS_VALID)
  return createdAt < cutoff
}

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private async getUserOrg(userId: string) {
    return this.prisma.organizationUser.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    })
  }

  private async audit(userId: string, action: string, resource: string, resourceId?: string, metadata?: any, ip?: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      await this.prisma.auditLog.create({
        data: {
          userId,
          userName: user?.name || "unknown",
          action,
          resource,
          resourceId,
          ip: ip || "0.0.0.0",
          userAgent: "team-service",
          metadata: metadata || undefined,
        },
      })
    } catch (err) {
      console.error("Team audit failed:", err)
    }
  }

  async getOrganization(userId: string) {
    let membership = await this.getUserOrg(userId)
    if (!membership) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      const slug = "team-" + userId.slice(0, 12)
      const org = await this.prisma.organization.create({
        data: { name: `${user?.name || "User"}'s Team`, slug },
      })
      membership = await this.prisma.organizationUser.create({
        data: { userId, organizationId: org.id, role: "ADMIN" },
        include: { organization: true },
      })
    }
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      myRole: membership.role,
      createdAt: membership.organization.createdAt,
    }
  }

  async getMembers(userId: string) {
    let membership = await this.getUserOrg(userId)
    if (!membership) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      const slug = "team-" + userId.slice(0, 12)
      const org = await this.prisma.organization.create({
        data: { name: `${user?.name || "User"}'s Team`, slug },
      })
      membership = await this.prisma.organizationUser.create({
        data: { userId, organizationId: org.id, role: "ADMIN" },
        include: { organization: true },
      })
    }

    return this.prisma.organizationUser.findMany({
      where: { organizationId: membership.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  }

  async invite(userId: string, dto: { email: string; role: string }, ip?: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership || membership.role !== "ADMIN") {
      throw new ForbiddenException("Only admins can invite members")
    }

    if (!dto.email || !dto.email.includes("@")) {
      throw new BadRequestException("Valid email required")
    }

    const role = parseRole(dto.role)
    const inviter = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    const invitedByName = inviter?.name || "A team member"
    const orgName = membership.organization.name
    const appUrl = process.env.APP_URL || "http://localhost:3000"

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!targetUser) {
      const existingInvite = await this.prisma.invitation.findFirst({
        where: { email: dto.email, organizationId: membership.organizationId, status: "PENDING" },
      })

      const token = crypto.randomBytes(24).toString("hex")
      if (existingInvite) {
        await this.prisma.invitation.update({
          where: { id: existingInvite.id },
          data: { token, role },
        })
      } else {
        await this.prisma.invitation.create({
          data: {
            organizationId: membership.organizationId,
            email: dto.email,
            role,
            token,
            invitedBy: userId,
          },
        })
      }
      await this.audit(userId, "invite.pending", "invitation", undefined, { email: dto.email }, ip)

      await this.mail.sendInvitation({
        to: dto.email,
        invitedByName,
        organizationName: orgName,
        role,
        acceptUrl: `${appUrl}/invitations/${token}`,
        declineUrl: `${appUrl}/invitations/${token}`,
      }).catch((err: any) => { console.error("Failed to send invitation email:", err) })

      return { invited: true, email: dto.email, status: "pending" }
    }

    const existing = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: membership.organizationId,
          userId: targetUser.id,
        },
      },
    })
    if (existing) throw new BadRequestException("User is already a member")

    await this.prisma.organizationUser.create({
      data: {
        organizationId: membership.organizationId,
        userId: targetUser.id,
        role,
      },
    })
    await this.audit(userId, "invite.added", "organizationUser", undefined, { email: dto.email, role }, ip)
    return { invited: true, email: dto.email, role, status: "added" }
  }

  async getInvitationInfo(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true } } },
    })
    if (!invitation) throw new NotFoundException("Invitation not found")
    if (invitation.status !== "PENDING") throw new NotFoundException("Invitation is no longer active")
    if (isExpired(invitation.createdAt)) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } }).catch(() => {})
      throw new NotFoundException("Invitation has expired")
    }
    return {
      email: invitation.email,
      role: invitation.role,
      organization: invitation.organization,
      createdAt: invitation.createdAt,
    }
  }

  async getInvitations(email: string) {
    const all = await this.prisma.invitation.findMany({
      where: { email, status: "PENDING" },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })
    const valid = all.filter(i => !isExpired(i.createdAt))
    const expired = all.filter(i => isExpired(i.createdAt))
    if (expired.length > 0) {
      await this.prisma.invitation.updateMany({
        where: { id: { in: expired.map(i => i.id) } },
        data: { status: "EXPIRED" },
      }).catch((err: any) => console.error("Failed to expire old invitations:", err))
    }
    return valid
  }

  async acceptInvite(userId: string, token: string, ip?: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } })
    if (!invitation) throw new NotFoundException("Invalid invitation token")
    if (invitation.status !== "PENDING") throw new BadRequestException("Invitation is no longer pending")
    if (isExpired(invitation.createdAt)) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } }).catch(() => {})
      throw new BadRequestException("Invitation has expired")
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException("This invitation was sent to a different email")
    }

    const existing = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
    })
    if (existing) {
      await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } })
      return { accepted: true, note: "Already a member" }
    }

    await this.prisma.organizationUser.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
    })
    await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } })
    await this.audit(userId, "invite.accepted", "invitation", invitation.id, undefined, ip)
    return { accepted: true }
  }

  async declineInvite(userId: string, token: string, ip?: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } })
    if (!invitation) throw new NotFoundException("Invalid invitation token")
    if (invitation.status !== "PENDING") throw new BadRequestException("Invitation is no longer pending")

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException("This invitation was sent to a different email")
    }

    await this.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "DECLINED" } })
    await this.audit(userId, "invite.declined", "invitation", invitation.id, undefined, ip)
    return { declined: true }
  }

  async removeMember(userId: string, memberId: string, ip?: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership || membership.role !== "ADMIN") {
      throw new ForbiddenException("Only admins can remove members")
    }

    const target = await this.prisma.organizationUser.findFirst({
      where: { id: memberId, organizationId: membership.organizationId },
    })
    if (!target) throw new NotFoundException("Member not found")

    if (target.role === "ADMIN") {
      const adminCount = await this.prisma.organizationUser.count({
        where: { organizationId: membership.organizationId, role: "ADMIN" },
      })
      if (adminCount <= 1) throw new ForbiddenException("Cannot remove the last admin — transfer admin role first")
    }

    await this.prisma.organizationUser.delete({ where: { id: memberId } })
    await this.audit(userId, "member.removed", "organizationUser", memberId, undefined, ip)
    return { removed: true }
  }

  async updateRole(userId: string, memberId: string, newRole: string, ip?: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership || membership.role !== "ADMIN") {
      throw new ForbiddenException("Only admins can change roles")
    }

    const role = parseRole(newRole)

    const target = await this.prisma.organizationUser.findFirst({
      where: { id: memberId, organizationId: membership.organizationId },
    })
    if (!target) throw new NotFoundException("Member not found")
    if (target.role === "ADMIN" && userId !== target.userId) {
      throw new ForbiddenException("Cannot change another admin's role")
    }

    await this.prisma.organizationUser.update({
      where: { id: memberId },
      data: { role },
    })
    await this.audit(userId, "member.role_changed", "organizationUser", memberId, { from: target.role, to: role }, ip)
    return { updated: true }
  }

  async leaveOrganization(userId: string, ip?: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership) throw new NotFoundException("Not a member of any organization")

    if (membership.role === "ADMIN") {
      const adminCount = await this.prisma.organizationUser.count({
        where: { organizationId: membership.organizationId, role: "ADMIN" },
      })
      if (adminCount <= 1) throw new ForbiddenException("Transfer admin role to another member before leaving")
    }

    await this.prisma.organizationUser.delete({ where: { id: membership.id } })
    await this.audit(userId, "member.left", "organizationUser", membership.id, undefined, ip)
    return { left: true }
  }

  async getStats(userId: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership) throw new NotFoundException("Not a member of any organization")

    const members = await this.prisma.organizationUser.findMany({
      where: { organizationId: membership.organizationId },
      select: { role: true, userId: true },
    })

    const memberUserIds = members.map(m => m.userId)
    const adminCount = members.filter(m => m.role === "ADMIN").length
    const editorCount = members.filter(m => m.role === "EDITOR").length
    const viewerCount = members.filter(m => m.role === "VIEWER").length

    const [evidenceCount, casesCount, pendingInvitesCount] = await Promise.all([
      this.prisma.evidence.count({ where: { userId: { in: memberUserIds } } }),
      this.prisma.case.count({ where: { userId: { in: memberUserIds } } }),
      this.prisma.invitation.count({ where: { organizationId: membership.organizationId, status: "PENDING" } }),
    ])

    return {
      totalMembers: members.length,
      adminCount,
      editorCount,
      viewerCount,
      evidenceCount,
      casesCount,
      pendingInvitesCount,
      myRole: membership.role,
      plan: membership.organization.plan,
    }
  }

  async getActivity(userId: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership) throw new NotFoundException("Not a member of any organization")

    const members = await this.prisma.organizationUser.findMany({
      where: { organizationId: membership.organizationId },
      select: { userId: true },
    })
    const memberUserIds = members.map(m => m.userId)

    const logs = await this.prisma.auditLog.findMany({
      where: { userId: { in: memberUserIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    return logs.map(log => ({
      ...log,
      ip: sanitizeIp(log.ip),
    }))
  }

  async getSentInvitations(userId: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership || membership.role !== "ADMIN") {
      throw new ForbiddenException("Only admins can view sent invitations")
    }

    return this.prisma.invitation.findMany({
      where: { organizationId: membership.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    })
  }

  async revokeSentInvitation(userId: string, invitationId: string, ip?: string) {
    const membership = await this.getUserOrg(userId)
    if (!membership || membership.role !== "ADMIN") {
      throw new ForbiddenException("Only admins can revoke invitations")
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: membership.organizationId, status: "PENDING" },
    })
    if (!invitation) throw new NotFoundException("Invitation not found or no longer pending")

    await this.prisma.invitation.delete({ where: { id: invitationId } })
    await this.audit(userId, "invite.revoked", "invitation", invitationId, { email: invitation.email }, ip)
    return { revoked: true }
  }
}

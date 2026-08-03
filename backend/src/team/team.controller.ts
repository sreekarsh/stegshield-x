import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards, Req, Logger } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { TeamService } from "./team.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { extractClientIp } from "../common/utils"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Team")
@ApiBearerAuth()
@Controller("team")
export class TeamController {
  private readonly logger = new Logger(TeamController.name)
  constructor(private teamService: TeamService) {}

  @Get("organization")
  @UseGuards(JwtAuthGuard)
  async getOrganization(@Req() req: any) { return this.teamService.getOrganization(req.user.id) }

  @Get("members")
  @UseGuards(JwtAuthGuard)
  async getMembers(@Req() req: any) { return this.teamService.getMembers(req.user.id) }

  @Post("invite")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async invite(@Req() req: any, @Body() dto: { email: string; role: string }) {
    this.logger.log(`Team invite from user: ${req.user?.id}, email: ${dto.email}`)
    try {
      return await this.teamService.invite(req.user.id, dto, extractClientIp(req))
    } catch (err: any) {
      this.logger.error(`Team invite failed: ${err?.message || err}`, err?.stack)
      throw err
    }
  }

  @Delete("members/:id")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async removeMember(@Req() req: any, @Param("id") id: string) { return this.teamService.removeMember(req.user.id, id, extractClientIp(req)) }

  @Patch("members/:id/role")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateRole(@Req() req: any, @Param("id") id: string, @Body() dto: { role: string }) { return this.teamService.updateRole(req.user.id, dto.role, extractClientIp(req)) }

  @Get("invitations")
  @UseGuards(JwtAuthGuard)
  async getInvitations(@Req() req: any) { return this.teamService.getInvitations(req.user.email) }

  @Get("invitations/info/:token")
  async getInvitationInfo(@Param("token") token: string) { return this.teamService.getInvitationInfo(token) }

  @Post("invitations/:token/accept")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async acceptInvite(@Req() req: any, @Param("token") token: string) { return this.teamService.acceptInvite(req.user.id, token, extractClientIp(req)) }

  @Post("invitations/:token/decline")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async declineInvite(@Req() req: any, @Param("token") token: string) { return this.teamService.declineInvite(req.user.id, token, extractClientIp(req)) }

  @Post("leave")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async leaveOrganization(@Req() req: any) { return this.teamService.leaveOrganization(req.user.id, extractClientIp(req)) }

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) { return this.teamService.getStats(req.user.id) }

  @Get("activity")
  @UseGuards(JwtAuthGuard)
  async getActivity(@Req() req: any) { return this.teamService.getActivity(req.user.id) }

  @Get("invitations/sent")
  @UseGuards(JwtAuthGuard)
  async getSentInvitations(@Req() req: any) { return this.teamService.getSentInvitations(req.user.id) }

  @Delete("invitations/sent/:id")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async revokeSentInvitation(@Req() req: any, @Param("id") id: string) { return this.teamService.revokeSentInvitation(req.user.id, id, extractClientIp(req)) }

  @Post("invitations/sent/:id/resend")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resendInvitation(@Req() req: any, @Param("id") id: string) { return this.teamService.resendInvitation(req.user.id, id, extractClientIp(req)) }
}

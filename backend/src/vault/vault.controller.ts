import { Controller, Get, Delete, Patch, Param, Query, Body, UseGuards, Req } from "@nestjs/common"
import { VaultService } from "./vault.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { DecoyVaultGuard } from "../decoy/decoy-vault.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Vault")
@ApiBearerAuth()
@Controller("vault")
export class VaultController {
  constructor(private vaultService: VaultService) {}

  @Get()
  @UseGuards(JwtAuthGuard, DecoyVaultGuard)
  async getAll(
    @Req() req: any,
    @Query("page") page = 1,
    @Query("limit") limit = 100,
  ) {
    return this.vaultService.getAll(req.user.id, +page, +limit, req.decoyMode, req.fakeVaultId)
  }

  @Patch(":source/:id")
  @UseGuards(JwtAuthGuard)
  async rename(@Req() req: any, @Param("source") source: string, @Param("id") id: string, @Body("name") name: string) {
    return this.vaultService.rename(req.user.id, source, id, name)
  }

  @Delete(":source/:id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("source") source: string, @Param("id") id: string) {
    return this.vaultService.delete(req.user.id, source, id)
  }
}

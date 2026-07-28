import { Controller, Get, Patch, Post, Delete, Body, UseGuards, Req, Query, UseInterceptors, UploadedFile } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join } from "path"
import { ApiTags, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger"
import { Role } from "@prisma/client"
import { UsersService } from "./users.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { UpdateUserDto } from "./dto/update-user.dto"

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id)
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.id, dto)
  }

  @Post("avatar")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: join(process.cwd(), "uploads", "avatars"),
      filename: (_req, file, cb) => {
        cb(null, `avatar-${Date.now()}${extname(file.originalname)}`)
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  @ApiConsumes("multipart/form-data")
  async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const avatarUrl = `/uploads/avatars/${file.filename}`
    return this.usersService.update(req.user.id, { avatar: avatarUrl })
  }


  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  async findAll() {
    return this.usersService.findAll()
  }

  @Get("search")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  async search(@Query("q") q: string, @Req() req: any) {
    return this.usersService.search(q, req.user.id)
  }

  @Delete("me")
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.id)
  }

  @Post("export")
  @UseGuards(JwtAuthGuard)
  async exportData(@Req() req: any) {
    return this.usersService.exportData(req.user.id)
  }

  @Patch("me/settings")
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Req() req: any, @Body() body: Record<string, any>) {
    return this.usersService.updateSettings(req.user.id, body)
  }
}

import { Controller, Get, Patch, Post, Delete, Body, UseGuards, Req, Query, Param, UseInterceptors, UploadedFile, BadRequestException, Res, NotFoundException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join, basename } from "path"
import { existsSync, mkdirSync } from "fs"
import { Response } from "express"
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
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), "uploads", "avatars")
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        cb(null, dir)
      },
      filename: (_req, file, cb) => {
        cb(null, `avatar-${Date.now()}${extname(file.originalname)}`)
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  @ApiConsumes("multipart/form-data")
  async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Image file is required")
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`
    return this.usersService.update(req.user.id, { avatar: avatarUrl })
  }

  @Get("avatar-file/:filename")
  async getAvatarFile(@Param("filename") filename: string, @Res() res: Response) {
    const safeName = basename(filename)
    const filePath = join(process.cwd(), "uploads", "avatars", safeName)
    if (!existsSync(filePath)) {
      throw new NotFoundException("Avatar file not found")
    }
    return res.sendFile(filePath)
  }


  @Get("search")
  @UseGuards(JwtAuthGuard)
  async search(@Query("q") q: string, @Req() req: any) {
    return this.usersService.search(q, req.user.id)
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  async findAll() {
    return this.usersService.findAll()
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Param("id") id: string) {
    return this.usersService.getPublicProfile(id)
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

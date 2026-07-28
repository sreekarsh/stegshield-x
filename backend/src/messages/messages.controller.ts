import { Controller, Post, Get, Patch, Delete, Body, UseGuards, Req, Param } from "@nestjs/common"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import { MessagesService } from "./messages.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { SendMessageDto } from "./dto/send-message.dto"

@ApiTags("Messages")
@Controller("messages")
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async send(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.messagesService.send(req.user.id, dto)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getConversations(@Req() req: any) {
    return this.messagesService.getConversations(req.user.id)
  }

  @Get("with/:userId")
  @UseGuards(JwtAuthGuard)
  async getConversation(@Req() req: any, @Param("userId") userId: string) {
    return this.messagesService.getConversation(req.user.id, userId)
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async edit(@Req() req: any, @Param("id") id: string, @Body() dto: { content: string }) {
    return this.messagesService.edit(req.user.id, id, dto.content)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id") id: string) {
    return this.messagesService.delete(req.user.id, id)
  }
}

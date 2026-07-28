import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from "@nestjs/common"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import { ContactsService } from "./contacts.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { AddContactDto } from "./dto/add-contact.dto"
import { UpdateContactDto } from "./dto/update-contact.dto"

@ApiTags("Contacts")
@ApiBearerAuth()
@Controller("contacts")
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async add(@Req() req: any, @Body() dto: AddContactDto) {
    return this.contactsService.add(req.user.id, dto)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any) {
    return this.contactsService.findAll(req.user.id)
  }

  @Patch(":contactId")
  @UseGuards(JwtAuthGuard)
  async update(@Req() req: any, @Param("contactId") contactId: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.update(req.user.id, contactId, dto)
  }

  @Delete(":contactId")
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any, @Param("contactId") contactId: string) {
    return this.contactsService.remove(req.user.id, contactId)
  }
}

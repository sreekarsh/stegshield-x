import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async add(ownerId: string, dto: { contactId: string; alias?: string }) {
    if (ownerId === dto.contactId) {
      throw new ConflictException("Cannot add yourself as a contact")
    }

    const contactUser = await this.prisma.user.findUnique({
      where: { id: dto.contactId },
      select: { id: true },
    })

    if (!contactUser) {
      throw new NotFoundException("User not found")
    }

    const existing = await this.prisma.contact.findUnique({
      where: { ownerId_contactId: { ownerId, contactId: dto.contactId } },
    })

    if (existing) {
      return this.prisma.contact.findUnique({
        where: { id: existing.id },
        include: {
          contact: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        },
      })
    }

    return this.prisma.contact.create({
      data: {
        ownerId,
        contactId: dto.contactId,
        alias: dto.alias,
      },
      include: {
        contact: { select: { id: true, name: true, email: true, avatar: true } },
      },
    })
  }

  async findAll(ownerId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { ownerId },
      include: {
        contact: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return { contacts }
  }

  async update(ownerId: string, contactId: string, dto: { alias?: string }) {
    const contact = await this.prisma.contact.findUnique({
      where: { ownerId_contactId: { ownerId, contactId } },
    })

    if (!contact) {
      throw new NotFoundException("Contact not found")
    }

    return this.prisma.contact.update({
      where: { id: contact.id },
      data: { alias: dto.alias },
      include: {
        contact: { select: { id: true, name: true, email: true, avatar: true } },
      },
    })
  }

  async remove(ownerId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { ownerId_contactId: { ownerId, contactId } },
    })

    if (!contact) {
      throw new NotFoundException("Contact not found")
    }

    await this.prisma.contact.delete({ where: { id: contact.id } })
    return { message: "Contact removed" }
  }
}

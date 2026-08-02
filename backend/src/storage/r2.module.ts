import { Module } from "@nestjs/common"
import { HttpModule } from "@nestjs/axios"
import { R2Service } from "./r2.service"

@Module({
  imports: [HttpModule],
  providers: [R2Service],
  exports: [R2Service],
})
export class R2Module {}

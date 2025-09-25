import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Controller('cash-registers')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post()
  create(@Body() dto: CreateCashRegisterDto) {
    return this.cashRegisterService.create(dto);
  }

  @Get()
  findAll() {
    return this.cashRegisterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashRegisterService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCashRegisterDto) {
    return this.cashRegisterService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cashRegisterService.remove(+id);
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { MeterReadingsService } from './meter-readings.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('meter-readings')
export class MeterReadingsController {
  constructor(private readonly meterReadingsService: MeterReadingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Post()
  create(@Body() createMeterReadingDto: CreateMeterReadingDto) {
    return this.meterReadingsService.create(createMeterReadingDto);
  }

  /*@UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get()
  findAll() {
    return this.meterReadingsService.findAll();
  }*/
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('shift-readings')
  async getShiftReadingsAll(
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.meterReadingsService.getShiftReadingsAll(targetDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get('last-readings')
  async getLastReadingsAll() {
    return this.meterReadingsService.getLastReadingsAll();
  }

  /*@UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.meterReadingsService.findOne(id);
  }*/

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateMeterReadingDto: UpdateMeterReadingDto) {
    return this.meterReadingsService.update(id, updateMeterReadingDto);
  }

  /*@UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.meterReadingsService.remove(id);
  }*/
}

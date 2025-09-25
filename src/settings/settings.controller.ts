import { Controller, Get, Post, Put, Body, ValidationPipe, UsePipes, Param, Delete, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { ShiftDto } from './dto/shift.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Role } from 'src/auth/roles.enum';

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get()
  find() {
    return this.settingsService.findOne(); // setting_id = 1
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Body() dto: UpdateSettingDto) {
    return this.settingsService.update(dto); // update setting_id = 1
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto); // create setting_id = 1
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put("company")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateCompanyData(@Body() dto: UpdateSettingDto) {
    return this.settingsService.updateCompanyData(dto); // update only company data
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Get("health")
  healthCheck() {
    return this.settingsService.healthCheck();
  }

  // Shift management endpoints

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get("shifts")
  getShifts() {
    return this.settingsService.getShifts();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post("shifts")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  addShift(@Body() shiftDto: ShiftDto) {
    return this.settingsService.addShift(shiftDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put("shifts/:name")
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateShift(@Param("name") name: string, @Body() shiftDto: ShiftDto) {
    return this.settingsService.updateShift(name, shiftDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete("shifts/:name")
  deleteShift(@Param("name") name: string) {
    return this.settingsService.deleteShift(name);
  }
}



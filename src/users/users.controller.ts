import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  UseGuards,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService, UserPermissions } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserCreationGuard } from './guards/user-creation.guard'; // Si tienes uno propio
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Crear usuario
  @UseGuards(JwtAuthGuard)
  @Post()
  async createUser(@Body() dto: CreateUserDto, @Req() req: Request) {
    console.log('Usuario autenticado creando:', req.user);
    return this.usersService.create(dto, req.user as any);
  }

  // Listar todos los usuarios, filtrar por rol o estado activo
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('active') active?: string,
    @Req() req?: Request
  ) {
    console.log('LLEGO AL FINDALL DE USERS', req?.user);
    if (role) {
      return this.usersService.getUsersByRole(role);
    }
    if (active === 'true') {
      return this.usersService.getActiveUsers();
    }
    return this.usersService.findAll();
  }

  // Obtener usuario por ID
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: Request) {
    console.log('LLEGO AL FINDONE DE USERS', req?.user);
    return this.usersService.findOne(+id);
  }

  // Obtener permisos de un usuario
  @UseGuards(JwtAuthGuard)
  @Get(':id/permissions')
  async getUserPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(+id);
  }

  // Verificar si un usuario tiene un permiso específico
  @UseGuards(JwtAuthGuard)
  @Get(':id/permissions/check')
  async checkPermission(
    @Param('id') id: string,
    @Query('module') module: string,
    @Query('action') action: string
  ) {
    return this.usersService.hasPermission(+id, module, action);
  }

  // Actualizar usuario
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request
  ) {
    return this.usersService.update(+id, dto, req.user as any);
  }

  // Actualizar permisos de un usuario
  @UseGuards(JwtAuthGuard)
  @Put(':id/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Body() permissions: UserPermissions,
    @Req() req: Request
  ) {
    return this.usersService.updatePermissions(+id, permissions, req.user as any);
  }

  // Activar usuario
  @UseGuards(JwtAuthGuard)
  @Patch(':id/activate')
  async activate(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.activate(+id, req.user as any);
  }

  // Desactivar usuario
  @UseGuards(JwtAuthGuard)
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.deactivate(+id, req.user as any);
  }

  // Eliminar usuario
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.remove(+id, req.user as any);
  }

  // Validar credenciales (para login)
  @Post('validate')
  async validateUser(@Body() credentials: { username: string; password: string }) {
    const user = await this.usersService.validatePassword(
      credentials.username,
      credentials.password,
    );
    if (!user) {
      throw new ForbiddenException('Credenciales inválidas');
    }
    return {
      id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    };
  }
}

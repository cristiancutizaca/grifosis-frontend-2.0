import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const user = await this.authService.validateUser(body.username, body.password);
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  getProtected(@Request() req) {
    return {
      message: 'Ruta protegida accedida correctamente ✅',
      user: req.user,
    };
   }
  @UseGuards(JwtAuthGuard)
  @Get("superadmin")
  getSuperAdminRoute(@Request() req) {
    return {
      message: 'Ruta solo para SUPERADMIN',
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin")
  getAdminRoute(@Request() req) {
    return {
      message: 'Ruta solo para ADMIN',
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("seller")
  getSellerRoute(@Request() req) {
    return {
      message: 'Ruta solo para SELLER',
      user: req.user,
    };
  }

  @Post('register')
  async registerUser(
    @Body()
    body: { username: string; password: string; role: 'admin' | 'seller' | 'superadmin' },
  ) {
    try {
      const existing = await this.userRepo.findOne({ where: { username: body.username } });
      if (existing) {
        throw new ForbiddenException('El usuario ya existe');
      }

      const hash = await bcrypt.hash(body.password, 10);

      const user = this.userRepo.create({
        username: body.username,
        password_hash: hash,
        role: body.role,
        is_active: true, // ← AGREGAR ESTO
      });

      await this.userRepo.save(user);

      return {
        message: 'Usuario creado correctamente',
        user: {
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }
}

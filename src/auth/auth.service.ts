// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    console.log('Password ingresada:', password);
    console.log('Hash almacenado:', user.password_hash);

    const isMatch = await bcrypt.compare(password, user.password_hash);

    console.log('¿Coincide?', isMatch);

    if (!isMatch) throw new UnauthorizedException('Contraseña incorrecta');

    const { password_hash, ...result } = user;
    return result;
  }


  async login(user: any) {
    const payload = {
      sub: user.user_id,
      username: user.username,
      role: user.role,                    // 'seller' | 'admin' | 'superadmin'
      employee_id: user.employee_id,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

  import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
  } from '@nestjs/common';
  import { UsersService } from '../users.service';
  @Injectable()
  export class UserCreationGuard implements CanActivate {
    constructor(private usersService: UsersService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const user = request.user; // Usuario autenticado del JWT
      const targetRole = request.body.role; // Rol que intenta crear

      // Check robusto
      if (!user || typeof user.role !== 'string') {
        throw new ForbiddenException('Usuario no autenticado o sin rol');
      }
      if (!targetRole) {
        throw new ForbiddenException('Rol a crear no especificado');
      }

      // Jerarquía de roles
      const roleHierarchy = { superadmin: 3, admin: 2, seller: 1 };
      const creatorLevel = roleHierarchy[user.role];
      const targetLevel = roleHierarchy[targetRole];

      if (!creatorLevel || !targetLevel) {
        throw new ForbiddenException('Rol no válido');
      }

      // Permisos según rol
      if (user.role === 'superadmin') return true;

      if (user.role === 'admin') {
        if (targetRole === 'superadmin') {
          throw new ForbiddenException('Los administradores no pueden crear superadministradores');
        }
        return targetRole === 'admin' || targetRole === 'seller';
      }

      if (user.role === 'seller') {
        throw new ForbiddenException('Los vendedores no pueden crear usuarios');
      }

      throw new ForbiddenException('Permisos insuficientes para crear usuarios');
    }
  }

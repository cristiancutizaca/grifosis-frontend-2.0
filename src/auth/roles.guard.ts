import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { user } = context.switchToHttp().getRequest();

    // Debug para desarrollo (borra luego)
    console.log('User recibido en RolesGuard:', user);
    console.log('Roles requeridos:', requiredRoles);

    // Si el endpoint no requiere roles, pasa igual
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Si el usuario no está autenticado, bloquea
    if (!user || !user.role) {
      throw new ForbiddenException('Usuario no autenticado o sin rol');
    }

    // Soporta tanto string como array de roles
    if (Array.isArray(user.role)) {
      return requiredRoles.some(role => user.role.includes(role));
    } else {
      return requiredRoles.includes(user.role);
    }
  }
}
 

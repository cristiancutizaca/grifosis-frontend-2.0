import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Llamar al guard padre, pero no lanzar excepción si falla
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si hay un error o no hay usuario, simplemente retornar undefined
    // No lanzar excepción, permitir que la ruta continúe sin usuario
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}


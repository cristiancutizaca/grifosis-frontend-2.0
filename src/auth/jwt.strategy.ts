import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// —— Cache simple en memoria (Opción A)
type JwtPayload = { sub: number; username: string; role: string; employee_id?: number };
const userCache = new Map<number, { value: any; exp: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutos

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly isProd = process.env.NODE_ENV === 'production';
  private logDev = (...args: any[]) => { if (!this.isProd) console.log(...args); };

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'tu_clave_secreta',
    });
    // No exponemos el secret en logs; solo marcamos inicialización en dev
    this.logDev('🔧 JwtStrategy inicializada');
  }

  async validate(payload: JwtPayload) {
    const key = payload.sub;
    const now = Date.now();
    const cached = userCache.get(key);

    // HIT de cache: retorna sin loguear (evita spam)
    if (cached && cached.exp > now) {
      return cached.value;
    }

    // MISS de cache: logs solo en dev
    this.logDev('🔍 JwtStrategy.validate() ejecutándose');
    this.logDev('🔍 Payload recibido:', {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
    });

    const user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      employee_id: payload.employee_id,
    };

    // guarda en cache con expiración
    userCache.set(key, { value: user, exp: now + TTL_MS });

    this.logDev('🔍 User objeto creado:', user); 
    this.logDev('✅ JwtStrategy.validate() completado exitosamente');

    return user;
  }
}
 
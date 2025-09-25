import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PostgresExceptionFilter } from './common/filters/postgres-exception.filter';



// === Filtro global para silenciar logs ruidosos ===
function muteNoisyLogs() {
  const NOISY = [
    'LLEGO AL FINDONE DE USERS',
    'JwtStrategy.validate() ejecutándose',
    'Payload recibido',
    'User objeto creado',
  ];

  const originalLog = console.log.bind(console);
  console.log = (...args: any[]) => {
    try {
      const flat = args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .join(' ');
      if (NOISY.some((k) => flat.includes(k))) return; // corta el spam
    } catch {
      // si JSON.stringify falla, dejamos pasar el log
    }
    originalLog(...args);
  };
}

async function bootstrap() {
  // activar el filtro ANTES de crear la app
  muteNoisyLogs();

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new PostgresExceptionFilter());

  // Habilita CORS para el frontend (React, Next.js, etc)
  // Al llamar a enableCors() sin argumentos, NestJS habilita CORS para *todos* los orígenes.
  app.enableCors();

  // Prefijo global para la API
  app.setGlobalPrefix('api');

  // Activar validaciones globales de DTO y transformar el body correctamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Solo permite propiedades que estén en el DTO
      transform: true, // Transforma los datos al tipo definido en el DTO
      forbidNonWhitelisted: false, // Lanza un error si hay propiedades no definidas
    })
  );

  // Activar tu RolesGuard global (si lo estás usando)


  // Iniciar servidor en el puerto 8000 o el definido en variables de entorno
  await app.listen(process.env.PORT ?? 8000);
  console.log(` API corriendo en: http://localhost:${process.env.PORT ?? 8000}/api`);
}

bootstrap();
 
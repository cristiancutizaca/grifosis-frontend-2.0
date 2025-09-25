import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class PostgresExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Error por llave foránea
    if (exception.code === '23503') {
      const detail = exception.detail || 'Registro en uso por otra tabla.';

      return response.status(400).json({
        statusCode: 400,
        message: `No se puede eliminar porque está asociado a otros registros.`,
        detail,
        path: request.url,
      });
    }

    // Otros errores de DB
    return response.status(500).json({
      statusCode: 500,
      message: 'Error interno en la base de datos',
      error: exception.message,
      path: request.url,
    });
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Strategy {
    async save(tempPath: string, filename: string): Promise<any> {
        // Subir a S3 con AWS SDK
        // return URL del archivo
    }
}

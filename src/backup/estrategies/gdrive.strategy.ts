import { Injectable } from '@nestjs/common';

@Injectable()
export class GDriveStrategy {
    async save(tempPath: string, filename: string): Promise<any> {
        // Subir a Google Drive API
        // return enlace público o id
    }
}

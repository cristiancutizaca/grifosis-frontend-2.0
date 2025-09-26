import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStrategy {
  async save(tempPath: string, filename: string): Promise<string> {
    const localDir = process.env.BACKUP_DIR ?? 'var/backups/grifosis';

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    if (!fs.existsSync(tempPath)) {
      throw new Error(`El archivo temporal no existe: ${tempPath}`);
    }

    const destPath = path.join(localDir, filename);
    fs.copyFileSync(tempPath, destPath);
    return destPath;
  }
}

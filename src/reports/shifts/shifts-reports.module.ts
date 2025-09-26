import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { ShiftsMyReportsController } from './shifts-my-reports.controller';
import { ShiftsReportsService } from './shifts-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    // Si ya tienes guard JWT global, puedes quitar esta línea:
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ShiftsMyReportsController],
  providers: [ShiftsReportsService],
  exports: [ShiftsReportsService],
})
export class ShiftsReportsModule {}

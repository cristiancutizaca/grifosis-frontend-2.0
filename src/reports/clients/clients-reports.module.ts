import { Module } from '@nestjs/common';
import { ClientsReportsController } from './clients-reports.controller';
import { ClientsReportsService } from './clients-reports.service';

@Module({
  controllers: [ClientsReportsController],
  providers: [ClientsReportsService],
})
export class ClientsReportsModule {}

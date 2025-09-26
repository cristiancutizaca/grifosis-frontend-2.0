import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashBoxSession } from './cash-box-session.entity';
import { CashBoxService } from './cash-box.service';
import { CashBoxController } from '../cash-box.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CashBoxSession])],
  controllers: [CashBoxController],
  providers: [CashBoxService],
  exports: [CashBoxService],
})
export class CashBoxModule {}

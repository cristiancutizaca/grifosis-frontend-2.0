import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Param, 
  Body, 
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards
} from '@nestjs/common';
import { PumpsTanksService } from './pumps-tanks.service';
import { CreatePumpTankDto } from './dto/create-pump-tank.dto';
import { UpdatePumpTankDto } from './dto/update-pump-tank.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('pumps-tanks')
export class PumpsTanksController {
  constructor(private readonly pumpsTanksService: PumpsTanksService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get()
  getAllPumpTankRelations() {
    return this.pumpsTanksService.getAllPumpTankRelations();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get(':id')
  getPumpTankRelationById(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsTanksService.getPumpTankRelationById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get('pump/:pumpId')
  getTanksByPumpId(@Param('pumpId', ParseIntPipe) pumpId: number) {
    return this.pumpsTanksService.getTanksByPumpId(pumpId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN, Role.SUPERADMIN)
  @Get('tank/:tankId')
  getPumpsByTankId(@Param('tankId', ParseIntPipe) tankId: number) {
    return this.pumpsTanksService.getPumpsByTankId(tankId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Post('assign-tanks')
  assignTanks(@Body() createPumpTankDto: CreatePumpTankDto) {
    const { pump_id, tank_ids } = createPumpTankDto;
    return this.pumpsTanksService.assignTanksToPump(pump_id, tank_ids);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put(':id')
  updatePumpTankRelation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePumpTankDto: UpdatePumpTankDto
  ) {
    return this.pumpsTanksService.updatePumpTankRelation(id, updatePumpTankDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePumpTankRelation(@Param('id', ParseIntPipe) id: number) {
    return this.pumpsTanksService.deletePumpTankRelation(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Delete('pump/:pumpId/tank/:tankId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSpecificPumpTankRelation(
    @Param('pumpId', ParseIntPipe) pumpId: number,
    @Param('tankId', ParseIntPipe) tankId: number
  ) {
    return this.pumpsTanksService.removeSpecificPumpTankRelation(pumpId, tankId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @Put('pump/:pumpId/tanks')
  replaceTanksForPump(
    @Param('pumpId', ParseIntPipe) pumpId: number,
    @Body('tankIds') tankIds: number[]
  ) {
    return this.pumpsTanksService.replaceTanksForPump(pumpId, tankIds);
  }
}
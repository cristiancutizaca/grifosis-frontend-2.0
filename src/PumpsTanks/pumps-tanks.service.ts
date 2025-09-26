import { 
  Injectable, 
  NotFoundException, 
  ConflictException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pump } from '../pumps/entities/pump.entity';
import { Tank } from '../tanks/entities/tank.entity';
import { PumpTank } from './entities/pump-tank.entity';
import { CreatePumpTankDto } from './dto/create-pump-tank.dto';
import { UpdatePumpTankDto } from './dto/update-pump-tank.dto';

@Injectable()
export class PumpsTanksService {
  constructor(
    @InjectRepository(Pump)
    private readonly pumpRepo: Repository<Pump>,
    @InjectRepository(Tank)
    private readonly tankRepo: Repository<Tank>,
    @InjectRepository(PumpTank)
    private readonly pumpTankRepo: Repository<PumpTank>,
  ) {}

  async getAllPumpTankRelations() {
    return await this.pumpTankRepo.find({
      relations: ['pump', 'tank'],
      order: {
        created_at: 'DESC'
      }
    });
  }

  async getPumpTankRelationById(id: number) {
    const relation = await this.pumpTankRepo.findOne({
      where: { id },
      relations: ['pump', 'tank']
    });

    if (!relation) {
      throw new NotFoundException(`Relación pump-tank con ID ${id} no encontrada`);
    }

    return relation;
  }

  async getTanksByPumpId(pumpId: number) {
    const pump = await this.pumpRepo.findOne({ where: { pump_id: pumpId } });
    if (!pump) {
      throw new NotFoundException(`Surtidor con ID ${pumpId} no encontrado`);
    }

    const relations = await this.pumpTankRepo.find({
      where: { pump: { pump_id: pumpId } },
      relations: ['tank']
    });

    return relations.map(relation => relation.tank);
  }

  async getPumpsByTankId(tankId: number) {
    const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
    if (!tank) {
      throw new NotFoundException(`Tanque con ID ${tankId} no encontrado`);
    }

    const relations = await this.pumpTankRepo.find({
      where: { tank: { tank_id: tankId } },
      relations: ['pump']
    });

    return relations.map(relation => relation.pump);
  }

  async createPumpTankRelation(createPumpTankDto: CreatePumpTankDto) {
    const { pump_id, tank_ids } = createPumpTankDto;

    const pump = await this.pumpRepo.findOne({ where: { pump_id } });
    if (!pump) {
      throw new NotFoundException(`Surtidor con ID ${pump_id} no encontrado`);
    }

    const createdRelations: PumpTank[] = [];

    for (const tankId of tank_ids) {
      const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
      if (!tank) {
        throw new NotFoundException(`Tanque con ID ${tankId} no encontrado`);
      }

      // Verificar si ya existe la relación
      const existingRelation = await this.pumpTankRepo.findOne({
        where: {
          pump: { pump_id },
          tank: { tank_id: tankId },
        },
      });

      if (existingRelation) {
        throw new ConflictException(`La relación entre surtidor ${pump_id} y tanque ${tankId} ya existe`);
      }

      const relation = this.pumpTankRepo.create({
        pump,
        tank,
      });

      const savedRelation = await this.pumpTankRepo.save(relation);
      createdRelations.push(savedRelation);
    }

    return {
      message: 'Relaciones pump-tank creadas exitosamente',
      relations: createdRelations
    };
  }

  async updatePumpTankRelation(id: number, updatePumpTankDto: UpdatePumpTankDto) {
    const relation = await this.getPumpTankRelationById(id);
    
    if (updatePumpTankDto.pump_id) {
      const pump = await this.pumpRepo.findOne({ 
        where: { pump_id: updatePumpTankDto.pump_id } 
      });
      if (!pump) {
        throw new NotFoundException(`Surtidor con ID ${updatePumpTankDto.pump_id} no encontrado`);
      }
      relation.pump = pump;
    }

    if (updatePumpTankDto.tank_ids && updatePumpTankDto.tank_ids.length > 0) {
      // Para actualización, solo tomamos el primer tank_id
      const tankId = updatePumpTankDto.tank_ids[0];
      const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
      if (!tank) {
        throw new NotFoundException(`Tanque con ID ${tankId} no encontrado`);
      }
      relation.tank = tank;
    }

    const updatedRelation = await this.pumpTankRepo.save(relation);
    
    return {
      message: 'Relación pump-tank actualizada exitosamente',
      relation: updatedRelation
    };
  }

  async deletePumpTankRelation(id: number) {
    const relation = await this.getPumpTankRelationById(id);
    await this.pumpTankRepo.remove(relation);
    
    return {
      message: 'Relación pump-tank eliminada exitosamente'
    };
  }

  async removeAllTanksFromPump(pumpId: number) {
    const pump = await this.pumpRepo.findOne({ where: { pump_id: pumpId } });
    if (!pump) {
      throw new NotFoundException(`Surtidor con ID ${pumpId} no encontrado`);
    }

    const relations = await this.pumpTankRepo.find({
      where: { pump: { pump_id: pumpId } }
    });

    if (relations.length === 0) {
      throw new NotFoundException(`No se encontraron relaciones para el surtidor ${pumpId}`);
    }

    await this.pumpTankRepo.remove(relations);
    
    return {
      message: `Todas las relaciones del surtidor ${pumpId} han sido eliminadas`,
      deletedCount: relations.length
    };
  }

  async removeAllPumpsFromTank(tankId: number) {
    const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
    if (!tank) {
      throw new NotFoundException(`Tanque con ID ${tankId} no encontrado`);
    }

    const relations = await this.pumpTankRepo.find({
      where: { tank: { tank_id: tankId } }
    });

    if (relations.length === 0) {
      throw new NotFoundException(`No se encontraron relaciones para el tanque ${tankId}`);
    }

    await this.pumpTankRepo.remove(relations);
    
    return {
      message: `Todas las relaciones del tanque ${tankId} han sido eliminadas`,
      deletedCount: relations.length
    };
  }

  async removeSpecificPumpTankRelation(pumpId: number, tankId: number) {
    const relation = await this.pumpTankRepo.findOne({
      where: {
        pump: { pump_id: pumpId },
        tank: { tank_id: tankId },
      },
      relations: ['pump', 'tank']
    });

    if (!relation) {
      throw new NotFoundException(`No se encontró relación entre surtidor ${pumpId} y tanque ${tankId}`);
    }

    await this.pumpTankRepo.remove(relation);
    
    return {
      message: `Relación entre surtidor ${pumpId} y tanque ${tankId} eliminada exitosamente`
    };
  }

  async replaceTanksForPump(pumpId: number, tankIds: number[]) {
    const pump = await this.pumpRepo.findOne({ where: { pump_id: pumpId } });
    if (!pump) {
      throw new NotFoundException(`Surtidor con ID ${pumpId} no encontrado`);
    }

    // Eliminar todas las relaciones existentes del surtidor
    const existingRelations = await this.pumpTankRepo.find({
      where: { pump: { pump_id: pumpId } }
    });

    if (existingRelations.length > 0) {
      await this.pumpTankRepo.remove(existingRelations);
    }

    // Crear nuevas relaciones
    const newRelations: PumpTank[] = [];
    for (const tankId of tankIds) {
      const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
      if (!tank) {
        throw new NotFoundException(`Tanque con ID ${tankId} no encontrado`);
      }

      const relation = this.pumpTankRepo.create({
        pump,
        tank,
      });

      const savedRelation = await this.pumpTankRepo.save(relation);
      newRelations.push(savedRelation);
    }

    return {
      message: `Tanques del surtidor ${pumpId} reemplazados exitosamente`,
      removedCount: existingRelations.length,
      addedCount: newRelations.length,
      relations: newRelations
    };
  }

  async assignTanksToPump(pumpId: number, tankIds: number[]) {
    const pump = await this.pumpRepo.findOne({ where: { pump_id: pumpId } });
    if (!pump) {
      throw new NotFoundException('Surtidor no encontrado');
    }

    const createdRelations: PumpTank[] = [];
    const skippedRelations: Array<{ tankId: number; reason: string }> = [];

    for (const tankId of tankIds) {
      const tank = await this.tankRepo.findOne({ where: { tank_id: tankId } });
      if (!tank) {
        skippedRelations.push({ tankId, reason: 'Tanque no encontrado' });
        continue;
      }

      // Verificar si ya existe la relación antes de crearla
      const existingRelation = await this.pumpTankRepo.findOne({
        where: {
          pump: { pump_id: pumpId },
          tank: { tank_id: tankId },
        },
      });

      if (existingRelation) {
        skippedRelations.push({ tankId, reason: 'Relación ya existe' });
        continue;
      }

      const relation = this.pumpTankRepo.create({
        pump,
        tank,
      });
      
      const savedRelation = await this.pumpTankRepo.save(relation);
      createdRelations.push(savedRelation);
    }

    return { 
      message: 'Proceso de asignación completado',
      created: createdRelations,
      skipped: skippedRelations
    };
  }
}
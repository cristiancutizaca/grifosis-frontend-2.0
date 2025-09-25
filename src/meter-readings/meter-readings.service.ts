import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MeterReading } from './entities/meter-reading.entity';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { UpdateMeterReadingDto } from './dto/update-meter-reading.dto';
import { Nozzle } from '../nozzles/entities/nozzle.entity';
import { User } from '../users/entities/user.entity';
import { MeterReadingResponseDto } from './dto/meter-reading-response.dto';
import { SettingsService } from 'src/settings/settings.service';

@Injectable()
export class MeterReadingsService {
  constructor(
    @InjectRepository(MeterReading)
    private readonly meterReadingRepository: Repository<MeterReading>,
    @InjectRepository(Nozzle)
    private readonly nozzleRepository: Repository<Nozzle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly settingsService: SettingsService,
  ) {}

  private toResponseDto(entity: MeterReading): MeterReadingResponseDto {
    return {
      reading_id: entity.reading_id,
      nozzle_id: entity.nozzle?.nozzle_id,
      initial_reading: entity.initial_reading,
      final_reading: entity.final_reading,
      total_dispensed: entity.total_dispensed,
      user_id: entity.user?.user_id,
      created_at: entity.created_at,
      updated_at: entity.updated_at ?? null,
    };
  }

  async create(createDto: CreateMeterReadingDto): Promise<MeterReadingResponseDto> {
    const nozzle = await this.nozzleRepository.findOne({
      where: { nozzle_id: createDto.nozzle_id },
    });
    if (!nozzle) {
      throw new NotFoundException(`Nozzle con ID ${createDto.nozzle_id} no encontrado`);
    }

    const user = await this.userRepository.findOne({
      where: { user_id: createDto.user_id },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${createDto.user_id} no encontrado`);
    }

    const meterReading = this.meterReadingRepository.create({
      ...createDto,
      nozzle,
      user,
    });

    const saved = await this.meterReadingRepository.save(meterReading);
    return this.toResponseDto(saved);
  }

  async findAll(): Promise<MeterReadingResponseDto[]> {
    const readings = await this.meterReadingRepository.find({
      relations: ['nozzle', 'user'],
      order: { created_at: 'DESC' },
    });
    return readings.map(r => this.toResponseDto(r));
  }

  async findOne(id: number): Promise<MeterReadingResponseDto> {
    const reading = await this.meterReadingRepository.findOne({
      where: { reading_id: id },
      relations: ['nozzle', 'user'],
    });

    if (!reading) {
      throw new NotFoundException(`Lectura con ID ${id} no encontrada`);
    }

    return this.toResponseDto(reading);
  }

  async update(id: number, updateDto: UpdateMeterReadingDto): Promise<MeterReadingResponseDto> {
    const reading = await this.findOne(id); // aquí ya devuelve DTO, pero necesitamos entity

    const entity = await this.meterReadingRepository.findOne({
      where: { reading_id: id },
      relations: ['nozzle', 'user'],
    });

    if (!entity) {
      throw new NotFoundException(`Lectura con ID ${id} no encontrada`);
    }

    if (updateDto.nozzle_id) {
      const nozzle = await this.nozzleRepository.findOne({
        where: { nozzle_id: updateDto.nozzle_id },
      });
      if (!nozzle) {
        throw new NotFoundException(
          `Nozzle con ID ${updateDto.nozzle_id} no encontrado`,
        );
      }
      entity.nozzle = nozzle;
    }

    if (updateDto.user_id) {
      const user = await this.userRepository.findOne({
        where: { user_id: updateDto.user_id },
      });
      if (!user) {
        throw new NotFoundException(
          `Usuario con ID ${updateDto.user_id} no encontrado`,
        );
      }
      entity.user = user;
    }

    Object.assign(entity, updateDto);

    const updated = await this.meterReadingRepository.save(entity);
    return this.toResponseDto(updated);
  }

  async remove(id: number): Promise<void> {
    const reading = await this.meterReadingRepository.findOne({
      where: { reading_id: id },
    });

    if (!reading) {
      throw new NotFoundException(`Lectura con ID ${id} no encontrada`);
    }

    await this.meterReadingRepository.remove(reading);
  }

  /**
   * Other services
   */
  async getShiftReadingsAll(date: Date = new Date()) {
    const shifts = await this.settingsService.getShifts(); // { "Juan (Tarde)": "12:00-20:00", ... }
    const dispensadores = await this.nozzleRepository.find();
  
    // 1) Determinar turno ACTUAL (start / end)
    let currentShiftName: string | null = null;
    let shiftStart: Date | null = null;
    let shiftEnd: Date | null = null;
  
    for (const [shiftName, range] of Object.entries(shifts)) {
      const [startStr, endStr] = (range as string).split('-');
      const [startH, startM] = startStr.split(':').map(Number);
      const [endH, endM] = endStr.split(':').map(Number);
  
      const start = new Date(date); 
      start.setUTCHours(0, 0, 0, 0);
  
      let end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
  
      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }
  
      if (date >= start && date <= end) {
        currentShiftName = shiftName;
        shiftStart = start;
        shiftEnd = end;
        break;
      }
    }
  
    if (!shiftStart || !shiftEnd || !currentShiftName) {
      // No hay turno activo para la fecha/hora indicada
      throw new NotFoundException('No se encontró turno activo para la hora indicada');
    }
  
    // 2) Para cada dispensador: buscar firstReading y lastReading relativos al turno
    const results = await Promise.all(
      dispensadores.map(async (disp) => {
        // --- primera lectura DENTRO del turno (ASC)
        let firstReading = await this.meterReadingRepository
          .createQueryBuilder('r')
          .where('r.nozzle_id = :nozzleId', { nozzleId: disp.nozzle_id })
          .andWhere('r.created_at BETWEEN :start AND :end', {
            start: shiftStart.toISOString(),
            end: shiftEnd.toISOString(),
          })
          .orderBy('r.created_at', 'ASC')
          .getOne();
  
        // Si NO hay lecturas dentro del turno, tomar la última previa al inicio del turno
        if (!firstReading) {
          firstReading = await this.meterReadingRepository
            .createQueryBuilder('r')
            .where('r.nozzle_id = :nozzleId', { nozzleId: disp.nozzle_id })
            .andWhere('r.created_at <= :start', { start: shiftStart.toISOString() })
            .orderBy('r.created_at', 'DESC')
            .getOne();
        }
  
        // --- última lectura DENTRO del turno (DESC)
        let lastReading = await this.meterReadingRepository
          .createQueryBuilder('r')
          .where('r.nozzle_id = :nozzleId', { nozzleId: disp.nozzle_id })
          .andWhere('r.created_at BETWEEN :start AND :end', {
            start: shiftStart.toISOString(),
            end: shiftEnd.toISOString(),
          })
          .orderBy('r.created_at', 'DESC')
          .getOne();
  
        // Si no hay last dentro del turno pero existe first => usar first como fallback
        if (!lastReading && firstReading) {
          lastReading = firstReading;
        }
  
        return {
          nozzle_id: disp.nozzle_id,
          firstReading: firstReading ? this.toResponseDto(firstReading) : null,
          lastReading: lastReading ? this.toResponseDto(lastReading) : null,
          // opcional: shift: currentShiftName
        };
      })
    );
  
    // ordenar por nozzle_id asc
    return results.sort((a, b) => (a.nozzle_id ?? 0) - (b.nozzle_id ?? 0));
  }  

  async getLastReadingsAll(): Promise<MeterReadingResponseDto[]> {
    const dispensadores = await this.nozzleRepository.find();
  
    const results = await Promise.all(
      dispensadores.map(async (disp) => {
        const lastReading = await this.meterReadingRepository.findOne({
          where: { nozzle_id: disp.nozzle_id },
          relations: ['nozzle', 'user'],
          order: { created_at: 'DESC' },
        });
  
        return lastReading ? this.toResponseDto(lastReading) : {
          reading_id: null,
          nozzle_id: disp.nozzle_id,
          initial_reading: null,
          final_reading: null,
          total_dispensed: null,
          user_id: null,
          created_at: null,
          updated_at: null,
        };
      }),
    ) as MeterReadingResponseDto[];
  
    return results;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const exists = await this.clientsRepository.findOneBy({
      document_number: createClientDto.document_number,
    });

    if (exists) {
      throw new BadRequestException('El cliente ya existe');
    }

    const client = this.clientsRepository.create({
      ...createClientDto,
      category: createClientDto.category || 'regular',
    });

    return this.clientsRepository.save(client);
  }

  async findAll(filters: any = {}): Promise<Client[]> {
    const query = this.clientsRepository.createQueryBuilder('client');

    if (filters.category)
      query.andWhere('client.category = :category', {
        category: filters.category,
      });

    // Borré filtro de is_active, porque no existe más

    if (filters.search)
      query.andWhere(
        '(LOWER(client.first_name) LIKE LOWER(:search) OR LOWER(client.last_name) LIKE LOWER(:search) OR client.document_number LIKE :search)',
        { search: `%${filters.search}%` },
      );

    return query.getMany();
  }

  async findOne(id: number): Promise<Client> {
    const client = await this.clientsRepository.findOneBy({ client_id: id });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async update(id: number, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (dto.document_number && dto.document_number !== client.document_number) {
      const exists = await this.clientsRepository.findOneBy({
        document_number: dto.document_number,
      });
      if (exists)
        throw new BadRequestException('Documento ya registrado');
    }

    Object.assign(client, dto);
    return this.clientsRepository.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientsRepository.remove(client);
  }

  // Métodos de activar/desactivar eliminados (is_active ya no existe)

  async search(term: string): Promise<Client[]> {
    return this.clientsRepository
      .createQueryBuilder('client')
      .where('LOWER(client.first_name) LIKE LOWER(:term)', { term: `%${term}%` })
      .orWhere('LOWER(client.last_name) LIKE LOWER(:term)', { term: `%${term}%` })
      .orWhere('client.document_number LIKE :term', { term: `%${term}%` })
      .getMany();
  }

  async searchClients(term: string): Promise<Client[]> {
    return this.search(term);
  }

  async getTopClients(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT c.client_id, c.first_name, c.last_name, COUNT(s.sale_id) as total_sales
      FROM clients c
      LEFT JOIN sales s ON s.client_id = c.client_id
      GROUP BY c.client_id
      ORDER BY total_sales DESC
      LIMIT $1
    `;
    return this.dataSource.query(query, [limit]);
  }

  async getClientsByCategory(): Promise<any[]> {
    const query = `
      SELECT category, COUNT(*) as total
      FROM clients
      GROUP BY category
    `;
    return this.dataSource.query(query);
  }

  async getClientHistory(id: number, startDate?: string, endDate?: string): Promise<any[]> {
    let query = `SELECT * FROM sales WHERE client_id = $1`;
    const params: any[] = [id];

    if (startDate) {
      query += ` AND sale_date >= $2`;
      params.push(startDate);
    }

    if (endDate) {
      const index = params.length + 1;
      query += ` AND sale_date <= $${index}`;
      params.push(endDate);
    }

    return this.dataSource.query(query, params);
  }
async findOneWithCredits(id: number): Promise<Client> {
  const client = await this.clientsRepository.findOne({
    where: { client_id: id },
    relations: ['credits'],
  });
  if (!client) throw new NotFoundException('Cliente no encontrado');
  return client;
}

  // Métodos de contactos eliminados (contacts ya no existe en entity ni tabla)
}

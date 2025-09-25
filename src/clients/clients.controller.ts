import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query
} from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';
import { Client } from './../clients/entities/client.entity';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) { }

  @Post()
  async create(@Body() createClientDto: CreateClientDto) {
    const client = await this.clientsService.create(createClientDto);
    return client; // Esto es lo esperado
  }


  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    const filters: any = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    // Eliminado filtro 'active' e 'is_active'
    return this.clientsService.findAll(filters);
  }

  @Get('search/:term')
  searchClients(@Param('term') term: string) {
    return this.clientsService.searchClients(term);
  }

  @Get('categories/stats')
  getClientsByCategory() {
    return this.clientsService.getClientsByCategory();
  }

  @Get('top/:limit')
  getTopClients(@Param('limit') limit: string) {
    return this.clientsService.getTopClients(+limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(+id);
  }

  // Historial completo del cliente
  @Get(':id/history')
  getClientHistory(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.clientsService.getClientHistory(+id, startDate, endDate);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(+id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }

}

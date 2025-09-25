// src/employees/employees.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(): Promise<Employee[]> {
    return this.employeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Employee> {
    return this.employeesService.getById(+id);
  }

  @Post()
  async create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    const saved = await this.employeesService.create(dto);
    return saved;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto): Promise<Employee> {
    return this.employeesService.update(+id, dto);
  }

  // ✅ NUEVO: activar empleado
  @Patch(':id/activate')
  activate(@Param('id') id: string): Promise<Employee> {
    return this.employeesService.activate(+id);
  }

  // ✅ NUEVO: desactivar empleado
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string): Promise<Employee> {
    return this.employeesService.deactivate(+id);
  }

  // ✅ NUEVO: eliminar empleado
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.employeesService.delete(+id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common'; // Importa NotFoundException
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto'; // Importa UpdateEmployeeDto

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) { }

  async findAll(): Promise<Employee[]> {
    return this.employeeRepository.find();
  }

  async create(createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    const employee = this.employeeRepository.create(createEmployeeDto);
    // Por defecto, un nuevo empleado es activo
    employee.is_active = true; // Asegúrate de que tu entidad Employee tenga is_active
    const savedEmployee = await this.employeeRepository.save(employee);
    console.log(`Empleado creado con ID: ${savedEmployee.employee_id}`);
    return savedEmployee;
  }

  // MÉTODO NECESARIO PARA EL CONTROLADOR: Obtener empleado por ID
  async getById(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { employee_id: id } });
    if (!employee) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado`);
    }
    return employee;
  }

  // MÉTODO NECESARIO PARA EL CONTROLADOR: Actualizar un empleado
  async update(id: number, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee> {
    // preload carga una entidad existente por su ID y aplica los cambios del DTO
    // Si no encuentra la entidad, devuelve undefined
    const employee = await this.employeeRepository.preload({
      employee_id: id, // Asegúrate de que el ID se pase correctamente para la carga
      ...updateEmployeeDto,
    });

    if (!employee) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado para actualizar`);
    }
    return this.employeeRepository.save(employee); // Guarda los cambios
  }

  // MÉTODO NECESARIO PARA EL CONTROLADOR: Desactivar un empleado
  async deactivate(id: number): Promise<Employee> {
    const employee = await this.getById(id); // Reutiliza getById para encontrar el empleado
    employee.is_active = false;
    return this.employeeRepository.save(employee);
  }

  // MÉTODO NECESARIO PARA EL CONTROLADOR: Activar un empleado
  async activate(id: number): Promise<Employee> {
    const employee = await this.getById(id); // Reutiliza getById para encontrar el empleado
    employee.is_active = true;
    return this.employeeRepository.save(employee);
  }

  // MÉTODO NECESARIO PARA EL CONTROLADOR: Eliminar un empleado (eliminación física)
  async delete(id: number): Promise<void> {
    const result = await this.employeeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Empleado con ID ${id} no encontrado para eliminar`);
    }
  }
}

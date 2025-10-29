import ApiService from './apiService';
import EmployeeService, { CreateEmployeeDto, Employee } from './employeeService';

export interface User {
  user_id: number;
  employee_id?: number;
  username: string;
  role: string;
  permissions?: string;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  full_name?: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  role: string;
  employee_id?: number | null; // Permite null para evitar errores de unicidad
  full_name?: string;
  permissions?: any;
  is_active?: boolean; // Agregado el campo is_active que faltaba
}

// Nueva interfaz extendida para crear usuario y empleado simultáneamente
export interface CreateUserWithEmployeeDto extends CreateUserDto {
  // Campos del empleado
  dni: string;
  first_name: string;
  last_name: string;
  position: string;
  birth_date: string; // Formato YYYY-MM-DD
  address: string;
  phone_number: string;
  email: string;
  hire_date: string; // Formato YYYY-MM-DD
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: string;
  employee_id?: number | null; // Permite null también en la actualización
  full_name?: string;
  permissions?: any;
  is_active?: boolean;
}

// Interfaz para la respuesta del backend cuando se crea usuario y empleado
// CORREGIDO: employee_id ahora es opcional para permitir que los usuarios sin empleado también encajen en este tipo al recuperarlos.
export interface UserWithEmployeeResponse extends User {
  employee_id?: number; // Ahora es opcional, consistente con la interfaz User
  employee?: Employee;
}

class UserService {
  private readonly endpoint = '/users';

  // Obtener todos los usuarios (incluye inactivos)
  async getAll(): Promise<User[]> {
    try {
      return await this.list('all');
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }

  // Obtener usuarios activos
  async getActiveUsers(): Promise<User[]> {
    try {
      return await this.list('active'); // <— antes usabas ?active=true
    } catch (error) {
      console.error('Error al obtener usuarios activos:', error);
      throw error;
    }
  }


  // Obtener usuarios por rol
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      return await ApiService.get<User[]>(`${this.endpoint}?role=${role}`);
    } catch (error) {
      console.error('Error al obtener usuarios por rol:', error);
      throw error;
    }
  }

  // Obtener usuario por ID
  async getById(id: number): Promise<User> {
    try {
      return await ApiService.get<User>(`${this.endpoint}/${id}`);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  }

  // Crear nuevo usuario (método original mantenido para compatibilidad)
  async create(userData: CreateUserDto): Promise<User> {
    try {
      return await ApiService.post<User>(this.endpoint, userData);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }

  // MÉTODO CORREGIDO: Crear usuario y empleado en dos pasos separados
  async createUserAndEmployee(userData: CreateUserWithEmployeeDto): Promise<UserWithEmployeeResponse> {
    try {
      // Paso 1: Crear el empleado primero
      const createdEmployee = await EmployeeService.create({
        dni: userData.dni!,
        first_name: userData.first_name!,
        last_name: userData.last_name!,
        position: 'Vendedor',
        birth_date: userData.birth_date,
        address: userData.address,
        phone_number: userData.phone_number,
        email: userData.email,
        hire_date: userData.hire_date
      });

      // Paso 2: Crear el usuario con el employee_id obtenido
      // 2) Crear usuario con el employee_id generado
      const createdUser = await this.create({
        username: userData.username,
        password: userData.password,
        role: userData.role,
        employee_id: createdEmployee.employee_id,   // <- AQUÍ EL PUNTO CLAVE
        full_name: userData.full_name || `${userData.first_name} ${userData.last_name}`,
        permissions: userData.permissions,
        is_active: userData.is_active ?? true,
      });


      // Retornar el usuario con la información del empleado
      return {
        ...createdUser,
        employee_id: createdEmployee.employee_id,
        employee: createdEmployee,
      };


    } catch (error) {
      console.error('Error al crear usuario y empleado:', error);
      // Si falla la creación del usuario pero el empleado ya se creó,
      // podrías considerar eliminar el empleado creado para mantener consistencia
      throw error;
    }
  }

  // Actualizar usuario
  async update(id: number, userData: UpdateUserDto): Promise<User> {
    try {
      return await ApiService.patch<User>(`${this.endpoint}/${id}`, userData);
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }

  // Eliminar usuario
  // Eliminar usuario (soft por defecto)
  // delete(id) -> soft; delete(id, true) -> hard
  async delete(id: number, hard = false): Promise<void> {
    try {
      const q = hard ? '?hard=true' : '';
      await ApiService.delete(`${this.endpoint}/${id}${q}`);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  }

  // Activar usuario
  async activate(id: number): Promise<User> {
    try {
      return await ApiService.patch<User>(`${this.endpoint}/${id}/activate`, {});
    } catch (error) {
      console.error('Error al activar usuario:', error);
      throw error;
    }
  }

  // Desactivar usuario
  async deactivate(id: number): Promise<User> {
    try {
      return await ApiService.patch<User>(`${this.endpoint}/${id}/deactivate`, {});
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      throw error;
    }
  }

  // Obtener permisos de un usuario
  async getUserPermissions(id: number): Promise<any> {
    try {
      return await ApiService.get(`${this.endpoint}/${id}/permissions`);
    } catch (error) {
      console.error('Error al obtener permisos del usuario:', error);
      throw error;
    }
  }

  // Actualizar permisos de un usuario
  async updatePermissions(id: number, permissions: any): Promise<User> {
    try {
      return await ApiService.patch<User>(`${this.endpoint}/${id}/permissions`, permissions);
    } catch (error) {
      console.error('Error al actualizar permisos del usuario:', error);
      throw error;
    }
  }

  // Verificar si un usuario tiene un permiso específico
  async checkPermission(id: number, module: string, action: string): Promise<boolean> {
    try {
      const result = await ApiService.get<{ hasPermission: boolean }>(`${this.endpoint}/${id}/permissions/check?module=${module}&action=${action}`);
      return result.hasPermission;
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      throw error;
    }
  }

  // Validar credenciales de usuario
  async validateUser(username: string, password: string): Promise<any> {
    try {
      return await ApiService.post(`${this.endpoint}/validate`, { username, password });
    } catch (error) {
      console.error('Error al validar usuario:', error);
      throw error;
    }
  }

  // MÉTODO CORREGIDO: Obtener usuario con información del empleado asociado
  async getUserWithEmployee(id: number): Promise<UserWithEmployeeResponse> {
    try {
      // Paso 1: Obtener el usuario
      const user = await this.getById(id);

      // Paso 2: Si el usuario tiene employee_id, obtener la información del empleado
      if (user.employee_id) {
        const employee = await EmployeeService.getById(user.employee_id);
        return {
          ...user,
          employee: employee
        };
      }

      // Si no tiene empleado asociado, retornar solo el usuario (ahora compatible con UserWithEmployeeResponse)
      return user;
    } catch (error) {
      console.error('Error al obtener usuario con empleado:', error);
      throw error;
    }
  }

  // Nuevo: listar con filtro de estado
  async list(status: 'active' | 'all' = 'active'): Promise<User[]> {
    try {
      return await ApiService.get<User[]>(`${this.endpoint}?status=${status}`);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }



  // MÉTODO CORREGIDO: Obtener todos los usuarios con información de empleados
  async getAllWithEmployees(): Promise<UserWithEmployeeResponse[]> {
    try {
      // Paso 1: Obtener todos los usuarios
      const users = await this.getAll();

      // Paso 2: Obtener todos los empleados
      const employees = await EmployeeService.getAll();

      // Paso 3: Combinar la información
      const usersWithEmployees: UserWithEmployeeResponse[] = users.map(user => {
        if (user.employee_id) {
          const employee = employees.find(emp => emp.employee_id === user.employee_id);
          return {
            ...user,
            employee: employee
          };
        }
        // Si no tiene empleado asociado, retornar el usuario tal cual (ahora compatible)
        return user;
      });

      return usersWithEmployees;
    } catch (error) {
      console.error('Error al obtener usuarios con empleados:', error);
      throw error;
    }
  }

  // MÉTODO ADICIONAL: Crear usuario y empleado con rollback en caso de error
  async createUserAndEmployeeWithRollback(userData: CreateUserWithEmployeeDto): Promise<UserWithEmployeeResponse> {
    let createdEmployee: Employee | null = null;

    try {
      // Paso 1: Crear el empleado primero
      const employeeData: CreateEmployeeDto = {
        dni: userData.dni,
        first_name: userData.first_name,
        last_name: userData.last_name,
        position: userData.position,
        birth_date: userData.birth_date,
        address: userData.address,
        phone_number: userData.phone_number,
        email: userData.email,
        hire_date: userData.hire_date,
        is_active: true
      };

      createdEmployee = await EmployeeService.create(employeeData);

      // Paso 2: Crear el usuario con el employee_id obtenido
      const userDataWithEmployeeId: CreateUserDto = {
        username: userData.username,
        password: userData.password,
        role: userData.role,
        employee_id: createdEmployee.employee_id,
        full_name: userData.full_name || `${userData.first_name} ${userData.last_name}`,
        permissions: userData.permissions,
        is_active: userData.is_active ?? true
      };

      const createdUser = await this.create(userDataWithEmployeeId);

      // Retornar el usuario con la información del empleado
      return {
        ...createdUser,
        employee_id: createdEmployee.employee_id,
        employee: createdEmployee
      };

    } catch (error) {
      console.error('Error al crear usuario y empleado:', error);

      // Rollback: Si el empleado se creó pero falló la creación del usuario, eliminar el empleado
      if (createdEmployee) {
        try {
          await EmployeeService.delete(createdEmployee.employee_id);
          console.log('Rollback completado: empleado eliminado debido a error en creación de usuario');
        } catch (rollbackError) {
          console.error('Error en rollback al eliminar empleado:', rollbackError);
        }
      }

      throw error;
    }
  }
}

export default new UserService();

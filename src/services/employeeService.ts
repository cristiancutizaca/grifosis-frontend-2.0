// src/services/employeeService.ts
import ApiService from "./apiService";

export interface Employee {
  employee_id: number;
  dni: string;
  first_name: string;
  last_name: string;
  position: string;
  birth_date: string;
  address: string;
  phone_number: string;
  email: string;
  hire_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeDto {
  dni: string;
  first_name: string;
  last_name: string;
  position: string;
  birth_date: string; // YYYY-MM-DD
  address: string;
  phone_number: string;
  email: string;
  hire_date: string; // YYYY-MM-DD
  is_active?: boolean;
}

export interface UpdateEmployeeDto {
  dni?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  birth_date?: string;
  address?: string;
  phone_number?: string;
  email?: string;
  hire_date?: string;
  is_active?: boolean;
}

class EmployeeService {
  private readonly endpoint = "/employees";

  // ---------- helpers internos ----------
  private status(e: any): number | undefined {
    return e?.response?.status;
  }
  private is404(e: any) {
    return this.status(e) === 404;
  }
  private is405(e: any) {
    return this.status(e) === 405;
  }
  private is409(e: any) {
    return this.status(e) === 409;
  }

  // ---------- CRUD ----------
  async getAll(): Promise<Employee[]> {
    try {
      return await ApiService.get<Employee[]>(this.endpoint);
    } catch (error) {
      console.error("Error al obtener empleados:", error);
      throw error;
    }
  }

  async getById(id: number): Promise<Employee> {
    try {
      return await ApiService.get<Employee>(`${this.endpoint}/${id}`);
    } catch (error) {
      console.error("Error al obtener empleado:", error);
      throw error;
    }
  }

  async create(employeeData: CreateEmployeeDto): Promise<Employee> {
    try {
      return await ApiService.post<Employee>(this.endpoint, employeeData);
    } catch (error) {
      console.error("Error al crear empleado:", error);
      throw error;
    }
  }

  async update(id: number, employeeData: UpdateEmployeeDto): Promise<Employee> {
    try {
      return await ApiService.patch<Employee>(`${this.endpoint}/${id}`, employeeData);
    } catch (error) {
      console.error("Error al actualizar empleado:", error);
      throw error;
    }
  }

  /**
   * Eliminar con fallbacks:
   *  1) DELETE /employees/:id
   *  2) DELETE /employees/delete/:id
   *  3) POST   /employees/:id/delete
   * Si hay restricción de FK (409), lanza error con mensaje claro.
   * (Opcional) Soft delete automático: desactivar en lugar de borrar.
   */
  async delete(id: number, opts?: { softOnConflict?: boolean }): Promise<void> {
    const try1 = async () => ApiService.delete(`${this.endpoint}/${id}`);
    const try2 = async () => ApiService.delete(`${this.endpoint}/delete/${id}`);
    const try3 = async () => ApiService.post(`${this.endpoint}/${id}/delete`, {});

    // Intento 1
    try {
      await try1();
      return;
    } catch (e: any) {
      if (this.is409(e)) {
        // Conflicto por FK
        if (opts?.softOnConflict) {
          // Soft delete: desactivar
          await this.update(id, { is_active: false });
          return;
        }
        const msg = e?.response?.data?.message || "No se puede eliminar: el empleado tiene registros asociados.";
        const err = new Error(msg);
        // @ts-ignore
        (err as any).response = e?.response;
        throw err;
      }
      if (!this.is404(e) && !this.is405(e)) {
        console.error("Error al eliminar empleado:", e);
        throw e;
      }
      // si es 404/405, probamos fallback
    }

    // Intento 2
    try {
      await try2();
      return;
    } catch (e: any) {
      if (this.is409(e)) {
        if (opts?.softOnConflict) {
          await this.update(id, { is_active: false });
          return;
        }
        const msg = e?.response?.data?.message || "No se puede eliminar: el empleado tiene registros asociados.";
        const err = new Error(msg);
        // @ts-ignore
        (err as any).response = e?.response;
        throw err;
      }
      if (!this.is404(e) && !this.is405(e)) {
        console.error("Error al eliminar empleado (fallback 1):", e);
        throw e;
      }
    }

    // Intento 3
    try {
      await try3();
      return;
    } catch (e: any) {
      if (this.is409(e)) {
        if (opts?.softOnConflict) {
          await this.update(id, { is_active: false });
          return;
        }
        const msg = e?.response?.data?.message || "No se puede eliminar: el empleado tiene registros asociados.";
        const err = new Error(msg);
        // @ts-ignore
        (err as any).response = e?.response;
        throw err;
      }
      console.error("Error al eliminar empleado (fallback 2):", e);
      throw e;
    }
  }

  // ---------- utilidades de estado ----------
  async setActive(id: number, active: boolean): Promise<Employee> {
    return this.update(id, { is_active: active });
  }

  async getActiveEmployees(): Promise<Employee[]> {
    try {
      return await ApiService.get<Employee[]>(`${this.endpoint}?active=true`);
    } catch (error) {
      console.error("Error al obtener empleados activos:", error);
      throw error;
    }
  }

  async getByDni(dni: string): Promise<Employee> {
    try {
      return await ApiService.get<Employee>(`${this.endpoint}/dni/${dni}`);
    } catch (error) {
      console.error("Error al buscar empleado por DNI:", error);
      throw error;
    }
  }
}

export default new EmployeeService();

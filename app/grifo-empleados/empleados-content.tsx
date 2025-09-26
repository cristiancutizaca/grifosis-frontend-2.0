'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EmployeeService, {
  Employee as BackendEmployee,
  UpdateEmployeeDto
} from '../../src/services/employeeService';

import AddEmployeeModal from './modal/AddEmployeeModal';
import EditEmployeeModal from './modal/EditEmployeeModal';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  role: string;
}

interface Employee extends BackendEmployee {}

const GrifoEmpleados: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null); // para bloquear acciones por fila

  // normaliza texto (quita tildes, a minúsculas)
  const norm = (s?: string) =>
    (s ?? '')
      .toString()
      .normalize('NFD')
      // @ts-ignore - usamos propiedad unicode para diacríticos
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();

  const getUserRoleFromToken = useCallback(() => {
    try {
      const token = sessionStorage.getItem('authToken');
      if (token) {
        const decoded: JwtPayload = jwtDecode(token);
        return decoded.role;
      }
    } catch (e) {
      console.error('Error al decodificar el token:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    setUserRole(getUserRoleFromToken());
  }, [getUserRoleFromToken]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await EmployeeService.getAll();
      setEmployees(data);
    } catch (err: any) {
      console.error('Error al obtener empleados:', err);
      setError(err?.message || 'Error al cargar los empleados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEditClick = (employee: Employee) => {
    setEditingEmployee(employee);
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
  };

  const handleAddEmployee = () => {
    setShowAddModal(true);
  };

  const handleEmployeeCreated = () => {
    setShowAddModal(false);
    fetchEmployees();
  };

  const handleUpdateEmployee = async (id: number, updateData: UpdateEmployeeDto) => {
    try {
      await EmployeeService.update(id, updateData);
      fetchEmployees();
    } catch (err: any) {
      console.error('Error al actualizar empleado:', err);
      throw err;
    }
  };

  const handleToggleStatus = async (employeeId: number) => {
    try {
      const emp = employees.find(e => e.employee_id === employeeId);
      if (!emp) return;

      setWorkingId(employeeId);
      // Optimistic UI
      setEmployees(prev =>
        prev.map(e =>
          e.employee_id === employeeId ? { ...e, is_active: !e.is_active } : e
        )
      );

      await EmployeeService.setActive(employeeId, !emp.is_active);
    } catch (err: any) {
      console.error('Error al cambiar estado del empleado:', err);
      setError(err?.message || 'Error al cambiar el estado del empleado.');
      // revertir si falló
      setEmployees(prev =>
        prev.map(e =>
          e.employee_id === employeeId ? { ...e, is_active: !e.is_active } : e
        )
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleDeleteEmployee = async (employeeId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este empleado?')) return;

    try {
      setWorkingId(employeeId);
      // Optimistic remove
      const prev = employees;
      setEmployees(prev.filter(e => e.employee_id !== employeeId));

      await EmployeeService.delete(employeeId);
    } catch (err: any) {
      console.error('Error al eliminar empleado:', err);
      setError(err?.message || 'Error al eliminar el empleado.');
      // recargar desde backend por si quedó inconsistente
      fetchEmployees();
    } finally {
      setWorkingId(null);
    }
  };

  const filteredEmployees = employees.filter((emp: Employee) => {
    const term = norm(searchTerm);
    const matchesSearch =
      !term ||
      norm(emp.first_name).includes(term) ||
      norm(emp.last_name).includes(term) ||
      (emp.email && norm(emp.email).includes(term)) ||
      (emp.dni && emp.dni.includes(searchTerm.trim()));

    const matchesStatus =
      statusFilter === '' ||
      (statusFilter === 'Activo' && emp.is_active) ||
      (statusFilter === 'Inactivo' && !emp.is_active);

    return matchesSearch && matchesStatus;
  });

  const SearchIcon = () => (
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
  );

  const EditIcon = () => (
    <svg className="w-5 h-5 text-blue-400 hover:text-blue-300 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path>
    </svg>
  );

  const UsersIcon = () => (
    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
    </svg>
  );

  const isSeller = userRole === 'seller';

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Cargando empleados...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-slate-900 min-h-screen space-y-4 lg:space-y-6">
      <div>
        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <UsersIcon />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">Gestión de Empleados</h1>
              <p className="text-sm text-slate-400">Administra los vendedores del grifo</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-white">{employees.length}</div>
              <div className="text-sm text-slate-400">Total Empleados</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-green-400">
                {employees.filter((e: Employee) => e.is_active).length}
              </div>
              <div className="text-sm text-slate-400">Activos</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <div className="text-2xl font-bold text-red-400">
                {employees.filter((e: Employee) => !e.is_active).length}
              </div>
              <div className="text-sm text-slate-400">Inactivos</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-4 lg:p-6 border border-slate-700">
          <div className="flex flex-col lg:flex-row items-center gap-3 mb-6">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Buscar empleado por nombre, DNI, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-slate-400"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <SearchIcon />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-auto pl-10 pr-8 py-3 text-sm rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 text-white appearance-none cursor-pointer min-w-[160px]"
                >
                  <option value="">Todos los Estados</option>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
                  </svg>
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>

            {!isSeller && (
              <button
                onClick={handleAddEmployee}
                className="group relative w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3.5 px-8 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-orange-500/30 min-w-[200px] transform hover:scale-105 active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                  </div>
                  <span className="text-sm font-bold tracking-wide">Agregar Empleado</span>
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300"></div>
                <div className="absolute inset-0 rounded-xl border border-orange-300/20 group-hover:border-orange-300/40 transition-colors"></div>
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-600">
            <table className="min-w-full divide-y divide-slate-600">
              <thead className="bg-slate-700/50">
                <tr className="sticky top-0 z-10 bg-slate-700/50 backdrop-blur">
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Empleado</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">DNI</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Posición</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Fecha Contratación</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {emp.first_name?.charAt(0)}
                              {emp.last_name?.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-sm text-slate-400">{emp.position}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{emp.dni}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{emp.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{emp.position}</div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                          emp.is_active
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {emp.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-300">
                      {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('es-PE') : '-'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        {/* Editar */}
                        <button
                          onClick={() => handleEditClick(emp)}
                          className={`p-2 rounded-lg transition-colors ${
                            isSeller
                              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              : 'bg-blue-500/20 hover:bg-blue-500/30'
                          }`}
                          title={isSeller ? 'No tienes permiso para editar' : 'Editar empleado'}
                          disabled={isSeller || workingId === emp.employee_id}
                        >
                          <EditIcon />
                        </button>

                        {/* Activar/Desactivar */}
                        <button
                          onClick={() => handleToggleStatus(emp.employee_id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isSeller
                              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              : emp.is_active
                              ? 'bg-green-500/20 hover:bg-green-500/30'
                              : 'bg-red-500/20 hover:bg-red-500/30'
                          }`}
                          title={
                            isSeller
                              ? 'No tienes permiso para cambiar el estado'
                              : emp.is_active
                              ? 'Desactivar empleado'
                              : 'Activar empleado'
                          }
                          disabled={isSeller || workingId === emp.employee_id}
                        >
                          {emp.is_active ? (
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          )}
                        </button>

                        {/* Eliminar */}
                        <button
                          onClick={() => handleDeleteEmployee(emp.employee_id)}
                          className={`p-2 rounded-lg transition-colors ${
                            isSeller
                              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                              : 'bg-red-700/20 hover:bg-red-700/30 text-red-400'
                          }`}
                          title={isSeller ? 'No tienes permiso para eliminar' : 'Eliminar empleado permanentemente'}
                          disabled={isSeller || workingId === emp.employee_id}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <div className="text-slate-400 text-lg mb-2">No se encontraron empleados</div>
              <div className="text-slate-500 text-sm">Prueba ajustando los filtros de búsqueda</div>
            </div>
          )}
        </div>

        <AddEmployeeModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onEmployeeCreated={handleEmployeeCreated}
        />

        {editingEmployee && (
          <EditEmployeeModal
            employee={editingEmployee}
            onClose={handleCancelEdit}
            onSave={handleUpdateEmployee}
          />
        )}
      </div>
    </div>
  );
};

export default GrifoEmpleados;
// by zecsoneitor
// pagina funcionando por el poder del omnsia

import React, { useState, useEffect } from 'react';
import { User, Search, Calendar, Filter, Download, Eye } from 'lucide-react';
import employeeService, { Employee } from '../services/employeeService';

interface EmployeeSelectorProps {
  selectedEmployee: string;
  onEmployeeChange: (employeeId: string) => void;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  onDateRangeChange: (dateRange: { startDate: string; endDate: string }) => void;
  onGenerateReport: () => void;
}

const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({
  selectedEmployee,
  onEmployeeChange,
  dateRange,
  onDateRangeChange,
  onGenerateReport
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const employeeList = await employeeService.getActiveEmployees();
      setEmployees(employeeList);
    } catch (error) {
      console.error('Error al cargar empleados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee =>
    `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.dni.includes(searchTerm)
  );

  const selectedEmployeeData = employees.find(emp => emp.employee_id.toString() === selectedEmployee);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    onDateRangeChange({
      ...dateRange,
      [field]: value
    });
  };

  const setQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    onDateRangeChange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  };

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-xl border border-slate-600 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <User className="mr-3 h-6 w-6 text-orange-400" />
          Selector de Empleado y Período
        </h2>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-orange-400" />
          <span className="text-sm text-slate-300">Filtros Activos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector de Empleado */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Buscar Empleado
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Seleccionar Empleado
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => onEmployeeChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            >
              <option value="">Seleccione un empleado...</option>
              {filteredEmployees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id.toString()}>
                  {employee.first_name} {employee.last_name} - {employee.position}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployeeData && (
            <div className="bg-slate-600 rounded-lg p-4 border border-slate-500">
              <h4 className="font-semibold text-white mb-2">Empleado Seleccionado</h4>
              <div className="space-y-1 text-sm">
                <p className="text-slate-300">
                  <span className="font-medium">Nombre:</span> {selectedEmployeeData.first_name} {selectedEmployeeData.last_name}
                </p>
                <p className="text-slate-300">
                  <span className="font-medium">DNI:</span> {selectedEmployeeData.dni}
                </p>
                <p className="text-slate-300">
                  <span className="font-medium">Cargo:</span> {selectedEmployeeData.position}
                </p>
                <p className="text-slate-300">
                  <span className="font-medium">Email:</span> {selectedEmployeeData.email}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Selector de Fechas */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
              <Calendar className="mr-2 h-4 w-4" />
              Período de Consulta
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha Inicio</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha Fin</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Períodos Rápidos
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuickDateRange(0)}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={() => setQuickDateRange(7)}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
              >
                7 días
              </button>
              <button
                onClick={() => setQuickDateRange(30)}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
              >
                30 días
              </button>
              <button
                onClick={() => setQuickDateRange(90)}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
              >
                90 días
              </button>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Acciones del Reporte
            </label>
            <div className="space-y-3">
              <button
                onClick={onGenerateReport}
                disabled={!selectedEmployee}
                className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Eye className="mr-2 h-4 w-4" />
                Generar Reporte
              </button>
              
              <button
                disabled={!selectedEmployee}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </button>
            </div>
          </div>

          {selectedEmployee && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-orange-400 mb-2">Información del Reporte</h4>
              <div className="space-y-1 text-sm text-slate-300">
                <p>• Ventas individuales detalladas</p>
                <p>• Créditos y pagos específicos</p>
                <p>• Movimientos de inventario</p>
                <p>• Análisis de rendimiento</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeSelector;


import React, { useState } from 'react';
import { Calendar, Clock, User, Package, CreditCard, Users } from 'lucide-react';

interface FilterState {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  granularity: 'day' | 'week' | 'month' | 'shift';
  employee: string;
  product: string;
  paymentMethod: string;
  client: string;
}

interface ReportsFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const ReportsFilters: React.FC<ReportsFiltersProps> = ({ filters, onFiltersChange }) => {
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value
      }
    });
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
        <Calendar className="mr-2 h-5 w-5" />
        Filtros Principales
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Rango de Fechas */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            Rango de Fechas
          </label>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={filters.dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={filters.dateRange.endDate}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Granularidad */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <Clock className="mr-2 h-4 w-4" />
            Granularidad
          </label>
          <select
            value={filters.granularity}
            onChange={(e) => handleFilterChange('granularity', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="shift">Turno</option>
          </select>
        </div>

        {/* Empleado */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <User className="mr-2 h-4 w-4" />
            Empleado
          </label>
          <select
            value={filters.employee}
            onChange={(e) => handleFilterChange('employee', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Todos los empleados</option>
            <option value="emp1">Juan Pérez</option>
            <option value="emp2">María García</option>
            <option value="emp3">Carlos López</option>
            <option value="emp4">Ana Martínez</option>
          </select>
        </div>

        {/* Producto */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <Package className="mr-2 h-4 w-4" />
            Producto
          </label>
          <select
            value={filters.product}
            onChange={(e) => handleFilterChange('product', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Todos los productos</option>
            <option value="diesel">Diesel</option>
            <option value="premium">Premium</option>
            <option value="regular">Regular</option>
            <option value="gas">Gas</option>
          </select>
        </div>

        {/* Método de Pago */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <CreditCard className="mr-2 h-4 w-4" />
            Método de Pago
          </label>
          <select
            value={filters.paymentMethod}
            onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Todos los métodos</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="credit">Crédito</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>

        {/* Cliente */}
        <div className="space-y-3">
          <label className="flex items-center text-sm font-medium text-slate-300">
            <Users className="mr-2 h-4 w-4" />
            Cliente
          </label>
          <select
            value={filters.client}
            onChange={(e) => handleFilterChange('client', e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Todos los clientes</option>
            <option value="client1">Cliente Corporativo A</option>
            <option value="client2">Cliente Corporativo B</option>
            <option value="client3">Cliente Individual</option>
            <option value="client4">Gobierno Local</option>
          </select>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-700">
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            onFiltersChange({
              dateRange: { startDate: today, endDate: today },
              granularity: 'day',
              employee: '',
              product: '',
              paymentMethod: '',
              client: ''
            });
          }}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
        >
          Limpiar Filtros
        </button>
        <button
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
        >
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
};

export default ReportsFilters;
export type { FilterState };


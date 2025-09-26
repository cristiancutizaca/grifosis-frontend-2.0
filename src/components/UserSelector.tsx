import React, { useEffect, useMemo, useState } from 'react';
import { User as UserIcon, Search, Calendar, Filter, Eye } from 'lucide-react';
import ApiService from '../services/apiService';

interface UserLite {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  dni?: string;
  role?: string;
  name?: string;
  full_name?: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface UserSelectorProps {
  /** MODO SINGLE (compat) */
  selectedUser: string;
  onUserChange: (userId: string) => void;

  /** RANGO */
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;

  /** ACCIÓN */
  onGenerateReport: () => void;

  /** Filtro de completadas */
  onlyCompleted?: boolean;
  onOnlyCompletedChange?: (v: boolean) => void;

  /** Emitir nombre humano (solo single / multi etiqueta) */
  onUserNameChange?: (name?: string) => void;

  /** MODO MULTI (opcional/controlado) */
  multiMode?: boolean;
  onMultiModeChange?: (v: boolean) => void;

  /** Selección múltiple CSV “12,15,20” (opcional/controlado) */
  selectedUsersCsv?: string;
  onUsersCsvChange?: (csv: string) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({
  selectedUser,
  onUserChange,
  dateRange,
  onDateRangeChange,
  onGenerateReport,
  onlyCompleted,
  onOnlyCompletedChange,
  onUserNameChange,

  // multi (opcionales)
  multiMode,
  onMultiModeChange,
  selectedUsersCsv,
  onUsersCsvChange,
}) => {
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ---- single/multi controlado/no-controlado ----
  const [internalMulti, setInternalMulti] = useState(false);
  const multi = typeof multiMode === 'boolean' ? multiMode : internalMulti;

  const [internalCompleted, setInternalCompleted] = useState<boolean>(true);
  const completed = typeof onlyCompleted === 'boolean' ? onlyCompleted : internalCompleted;

  // helpers CSV <-> Set
  const parseCsv = (csv?: string) =>
    new Set(
      (csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => !Number.isNaN(n)),
    );

  const [internalMultiSet, setInternalMultiSet] = useState<Set<number>>(new Set());
  const multiSet = useMemo(
    () => (onUsersCsvChange ? parseCsv(selectedUsersCsv) : internalMultiSet),
    [selectedUsersCsv, onUsersCsvChange, internalMultiSet],
  );
  const multiCsv = useMemo(() => Array.from(multiSet).join(','), [multiSet]);

  // ------------------------------------------------------

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await ApiService.get<UserLite[]>('/users?active=true');
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => {
          const A = (a.full_name || a.name || a.username || '').toLowerCase();
          const B = (b.full_name || b.name || b.username || '').toLowerCase();
          return A.localeCompare(B);
        });
        setUsers(arr);
      } catch (err) {
        console.error('Error cargando usuarios:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const humanName = (u?: UserLite) => {
    if (!u) return '';
    if (u.full_name) return u.full_name;
    if (u.first_name || u.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
    if (u.name) return u.name;
    if (u.username) return u.username;
    return `Usuario #${u.user_id}`;
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.dni,
        u.name,
        u.full_name,
        String(u.user_id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, searchTerm]);

  const selectedUserData = useMemo(
    () => users.find((u) => String(u.user_id) === String(selectedUser)),
    [users, selectedUser],
  );

  // Emitir nombre a parent (single = nombre; multi = "Varios usuarios")
  useEffect(() => {
    if (multi) {
      onUserNameChange?.('Varios usuarios');
    } else if (selectedUserData) {
      onUserNameChange?.(humanName(selectedUserData));
    } else {
      onUserNameChange?.(undefined);
    }
  }, [multi, selectedUserData, onUserNameChange]);

  const handleDateChange = (field: keyof DateRange, value: string) => {
    const next = { ...dateRange, [field]: value };
    onDateRangeChange(next);
  };

  const setQuickDateRange = (daysBack: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysBack);
    onDateRangeChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  };

  const toggleCompleted = () => {
    const next = !completed;
    if (onOnlyCompletedChange) onOnlyCompletedChange(next);
    else setInternalCompleted(next);
  };

  const rangeInvalid =
    !dateRange.startDate ||
    !dateRange.endDate ||
    new Date(dateRange.endDate) < new Date(dateRange.startDate);

  // ------- helpers multi --------
  const setMultiSet = (next: Set<number>) => {
    if (onUsersCsvChange) onUsersCsvChange(Array.from(next).join(','));
    else setInternalMultiSet(next);
  };

  const toggleMultiUser = (id: number) => {
    const next = new Set(multiSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMultiSet(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(multiSet);
    filteredUsers.forEach((u) => next.add(u.user_id));
    setMultiSet(next);
  };

  const clearAll = () => setMultiSet(new Set());

  const selectedCount = multiSet.size;

  const toggleMultiMode = () => {
    const next = !multi;
    if (onMultiModeChange) onMultiModeChange(next);
    else setInternalMulti(next);

    // Si pasamos a multi y hay un usuario single elegido, lo agregamos
    if (!multi && selectedUser) {
      const ns = new Set(multiSet);
      ns.add(Number(selectedUser));
      setMultiSet(ns);
    }
  };

  // Habilitación del botón
  const canGenerate = multi ? selectedCount > 0 && !rangeInvalid : !!selectedUser && !rangeInvalid;

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl shadow-xl border border-slate-600 p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserIcon className="h-6 w-6 text-orange-400" />
          Selector de Usuario y Período
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-700 border border-slate-600 rounded-full px-3 py-1.5">
            <span className="text-sm text-slate-300 mr-2">Varios vendedores</span>
            <button
              onClick={toggleMultiMode}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                multi ? 'bg-orange-500' : 'bg-slate-500'
              }`}
              aria-pressed={multi}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  multi ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-orange-400" />
            <span className="text-sm text-slate-300">Filtros Activos</span>
          </div>
        </div>
      </div>

      {/* grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Columna 1: Usuario / Multi */}
        <div className="space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Buscar Usuario</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre, usuario o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* SINGLE */}
          {!multi && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Seleccionar Usuario
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => onUserChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                >
                  <option value="">{loading ? 'Cargando...' : 'Seleccione un usuario...'}</option>
                  {filteredUsers.map((u) => (
                    <option key={u.user_id} value={String(u.user_id)}>
                      {humanName(u)}
                      {u.role ? ` — ${u.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUserData && (
                <div className="bg-slate-600 rounded-lg p-4 border border-slate-500">
                  <h4 className="font-semibold text-white mb-2">Usuario Seleccionado</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-300">
                      <span className="font-medium">Usuario:</span>{' '}
                      {selectedUserData.username ?? humanName(selectedUserData)}
                    </p>
                    <p className="text-slate-300">
                      <span className="font-medium">Nombre:</span> {humanName(selectedUserData)}
                    </p>
                    {selectedUserData.dni && (
                      <p className="text-slate-300">
                        <span className="font-medium">DNI:</span> {selectedUserData.dni}
                      </p>
                    )}
                    {selectedUserData.role && (
                      <p className="text-slate-300">
                        <span className="font-medium">Rol:</span> {selectedUserData.role}
                      </p>
                    )}
                    {selectedUserData.email && (
                      <p className="text-slate-300">
                        <span className="font-medium">Email:</span> {selectedUserData.email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* MULTI */}
          {multi && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Selecciona varios usuarios
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs transition-colors"
                  >
                    Seleccionar todos (filtrados)
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs transition-colors"
                  >
                    Limpiar
                  </button>
                  <span className="text-xs text-slate-300 ml-auto">
                    Seleccionados: <strong>{selectedCount}</strong>
                  </span>
                </div>

                <div className="max-h-64 overflow-auto rounded-lg border border-slate-600">
                  <ul className="divide-y divide-slate-700 bg-slate-700/60">
                    {filteredUsers.map((u) => {
                      const checked = multiSet.has(u.user_id);
                      return (
                        <li key={u.user_id} className="flex items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMultiUser(u.user_id)}
                            className="h-4 w-4 accent-orange-500"
                          />
                          <span className="text-sm text-white truncate">
                            {humanName(u)}
                            {u.role ? ` — ${u.role}` : ''}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">#{u.user_id}</span>
                        </li>
                      );
                    })}
                    {!filteredUsers.length && (
                      <li className="px-3 py-2 text-sm text-slate-400">Sin resultados…</li>
                    )}
                  </ul>
                </div>

                {/* CSV visible (solo referencia) */}
                <div className="mt-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">IDs CSV:</span>{' '}
                  <span className="break-all">{multiCsv || '—'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Columna 2: Fechas */}
        <div className="space-y-4 min-w-0">
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Períodos Rápidos</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

          {/* Switch solo completadas */}
          <div className="flex items-center justify-between bg-slate-700 border border-slate-600 rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">Solo ventas completadas</p>
              <p className="text-xs text-slate-400">
                Usa el flag <code>onlyCompleted=true</code> del endpoint
              </p>
            </div>
            <button
              onClick={toggleCompleted}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                completed ? 'bg-orange-500' : 'bg-slate-500'
              }`}
              aria-pressed={completed}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  completed ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Columna 3: Acciones */}
        <div className="space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Acciones del Reporte</label>
            <div className="space-y-3">
              <button
                onClick={onGenerateReport}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Eye className="mr-2 h-4 w-4" />
                Generar Reporte
              </button>
            </div>
          </div>

          {/* Info dinámica según modo */}
          {!multi && selectedUser && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-orange-400 mb-2">Información del Reporte</h4>
              <div className="space-y-1 text-sm text-slate-300">
                <p>• Ventas individuales detalladas (incluye items)</p>
                <p>• Créditos generados y cobranzas</p>
                <p>• Movimientos de inventario</p>
                <p>• Análisis de rendimiento</p>
              </div>
            </div>
          )}

          {multi && selectedCount > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <h4 className="font-semibold text-orange-400 mb-2">Información del Reporte (Multi)</h4>
              <div className="space-y-1 text-sm text-slate-300">
                <p>• Listado de ventas de varios usuarios (una por una)</p>
                <p>• Descarga Excel/PDF desde la vista de ventas</p>
                <p>• Puede aplicar “solo completadas”</p>
                <p>• Inventario y créditos no se muestran en el listado múltiple</p>
              </div>
            </div>
          )}

          {rangeInvalid && (
            <div className="text-xs text-red-400">
              La fecha fin debe ser mayor o igual a la fecha inicio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSelector;

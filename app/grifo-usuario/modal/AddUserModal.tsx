'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, User, Lock, UserCheck, Eye, EyeOff, ShieldCheck, Search } from 'lucide-react';
import userService, { CreateUserDto } from '../../../src/services/userService';
import employeeService, { Employee } from '../../../src/services/employeeService';
import { jwtDecode } from 'jwt-decode';

type Role = 'superadmin' | 'admin' | 'seller';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: 'superadmin', label: 'Super Administrador' },
  { value: 'admin', label: 'Administrador' },
  { value: 'seller', label: 'Vendedor' },
];

function slugifyUsername(input: string) {
  return input
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 30);
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserCreated }) => {
  // ====== estado principal del formulario ======
  const [formData, setFormData] = useState<CreateUserDto>({
    username: '',
    password: '',
    role: 'seller',                 // <-- por defecto VENDEDOR
    full_name: '',
    permissions: {},
    is_active: true,
    employee_id: undefined,
  });

  const [fullAccess, setFullAccess] = useState(false);   // <-- desmarcado por defecto
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ====== contexto del usuario actual (limita opciones de rol) ======
  const [currentUserRole, setCurrentUserRole] = useState<Role>('seller');

  // ====== empleados / búsqueda ======
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  // ====== roles disponibles según quien crea ======
  const availableRoles = useMemo(() => {
    if (currentUserRole === 'superadmin') return ALL_ROLES;
    if (currentUserRole === 'admin') return ALL_ROLES.filter(r => r.value !== 'superadmin');
    return ALL_ROLES.filter(r => r.value === 'seller');
  }, [currentUserRole]);

  // ====== helpers ======
  const resetAll = () => {
    setError(null);
    setConfirmPassword('');
    setSearchTerm('');
    setSelectedEmployee(null);
    setSuggestOpen(false);
    setFullAccess(false);
    setFormData({
      username: '',
      password: '',
      role: 'seller',
      full_name: '',
      permissions: {},
      is_active: true,
      employee_id: undefined,
    });
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;

    setFormData(prev => ({
      ...prev,
      role: newRole,
      employee_id: newRole === 'seller' ? prev.employee_id : undefined,
    }));

    // si cambias a no-seller, limpia el empleado
    if (newRole !== 'seller') {
      setSelectedEmployee(null);
      setSearchTerm('');
    }

    // superadmin siempre full_access true (bloqueado visual)
    if (newRole === 'superadmin') setFullAccess(true);
    else setFullAccess(false);
  };

  // ====== efectos ======
  useEffect(() => {
    if (!isOpen) return;

    // rol del usuario autenticado
    const token = sessionStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const role = (decoded.role || decoded.rol || 'seller') as Role;
        setCurrentUserRole(role);
      } catch {
        setCurrentUserRole('seller');
      }
    } else {
      setCurrentUserRole('seller');
    }

    // cargar empleados
    employeeService
      .getAll()
      .then(setEmployees)
      .catch(err => console.error('Error al cargar empleados:', err));
  }, [isOpen]);

  // Si el rol actual no está permitido para el usuario que crea, corrigelo.
  useEffect(() => {
    if (!availableRoles.some(r => r.value === formData.role)) {
      setFormData(prev => ({ ...prev, role: availableRoles[0].value as Role }));
      setFullAccess(availableRoles[0].value === 'superadmin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableRoles]);

  // Autocompletar nombre y sugerir username al elegir empleado
  useEffect(() => {
    if (!selectedEmployee) return;

    const full = `${selectedEmployee.first_name ?? ''} ${selectedEmployee.last_name ?? ''}`.trim();
    const candidate =
      selectedEmployee.email?.split('@')[0] ||
      `${selectedEmployee.first_name ?? ''}.${selectedEmployee.last_name ?? ''}`;

    setFormData(prev => ({
      ...prev,
      full_name: prev.full_name?.trim() ? prev.full_name : full,
      username: prev.username?.trim() ? prev.username : slugifyUsername(candidate),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  // ====== validaciones ======
  const sellerNeedsEmployee = formData.role === 'seller' && !formData.employee_id;

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return employees.slice(0, 20);
    return employees
      .filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [employees, searchTerm]);

  // ====== submit ======
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (formData.role === 'seller' && !formData.employee_id) {
      setError('Para el rol Vendedor, debes asignar un empleado.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const computedFullAccess =
        formData.role === 'superadmin' ? true : !!fullAccess;

      const payload: CreateUserDto = {
        ...formData,
        permissions: { full_access: computedFullAccess },
      };

      await userService.create(payload);
      onUserCreated();
      handleClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Ocurrió un error al crear el usuario.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agregar Usuario</h2>
              <p className="text-sm text-slate-400">Crear un nuevo usuario del sistema</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Full name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Nombre Completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInput}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese el nombre completo del usuario"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Nombre de Usuario *</label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={(e) => {
                  const clean = slugifyUsername(e.target.value);
                  setFormData(prev => ({ ...prev, username: clean }));
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese el nombre de usuario"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Rol del Usuario *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleRoleChange}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white"
              required
            >
              {availableRoles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Employee (only seller) */}
          {formData.role === 'seller' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Asignar Empleado (Obligatorio)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                  className={`w-full bg-slate-700 border ${sellerNeedsEmployee ? 'border-red-500/60' : 'border-slate-600'} rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400`}
                  placeholder="Buscar empleado por nombre o email"
                />
                {suggestOpen && (
                  <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-lg mt-1 max-h-64 overflow-y-auto">
                    {filteredEmployees.length === 0 && (
                      <li className="p-3 text-slate-400">No se encontraron empleados.</li>
                    )}
                    {filteredEmployees.map(emp => (
                      <li
                        key={emp.employee_id}
                        className="p-3 hover:bg-slate-600 cursor-pointer text-white"
                        onMouseDown={() => {
                          setSelectedEmployee(emp);
                          setFormData(prev => ({ ...prev, employee_id: emp.employee_id }));
                          setSearchTerm(`${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim());
                          setSuggestOpen(false);
                        }}
                      >
                        {emp.first_name} {emp.last_name} {emp.email ? `(${emp.email})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {selectedEmployee && (
                  <p className="text-sm text-slate-400 mt-2">
                    Empleado seleccionado: {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </p>
                )}
              </div>
              {sellerNeedsEmployee && (
                <p className="text-xs text-red-400">Debes seleccionar un empleado para vendedores.</p>
              )}
            </div>
          )}

          {/* full_access */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="fullAccess"
              checked={formData.role === 'superadmin' ? true : fullAccess}
              onChange={(e) => setFullAccess(e.target.checked)}
              className="accent-orange-500 w-4 h-4"
              disabled={formData.role === 'superadmin'}
            />
            <label htmlFor="fullAccess" className="text-sm text-slate-300 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Acceso completo (full_access)
              {formData.role === 'superadmin' && (
                <span className="ml-2 text-xs text-orange-400">(Siempre activo para superadmin)</span>
              )}
            </label>
          </div>

          {/* is_active */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="accent-green-500 w-4 h-4"
            />
            <label htmlFor="isActive" className="text-sm text-slate-300 flex items-center gap-1">
              <UserCheck className="w-4 h-4" /> Usuario activo (is_active)
            </label>
          </div>

          {/* password */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInput}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-12 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese la contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* confirm */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Confirmar Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Confirme la contraseña"
                required
              />
            </div>
          </div>

          {/* actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 px-4 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creando...</span>
                </div>
              ) : (
                'Crear Usuario'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;

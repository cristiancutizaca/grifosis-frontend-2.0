'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Lock, UserCheck, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import userService, { CreateUserDto } from '../../../src/services/userService'
import employeeService, { Employee } from '../../../src/services/employeeService'
import { jwtDecode } from 'jwt-decode'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserCreated }) => {
  const [formData, setFormData] = useState<CreateUserDto>({
    username: "",
    password: "",
    role: 'superadmin',
    full_name: '',
    permissions: {},
    is_active: true,
    employee_id: undefined,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullAccess, setFullAccess] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false); // Estado para controlar la visibilidad de las sugerencias

  // Definición de la función handleClose
  const handleClose = () => {
    setError(null)
    setConfirmPassword('')
    setSearchTerm("")
    setSelectedEmployee(null)
    setIsSuggestionsOpen(false)
    setFormData({
      username: "",
      password: "",
      role: 'superadmin',
      full_name: '',
      permissions: {},
      is_active: true,
      employee_id: undefined,
    })
    onClose()
  }

  // Definición de handleInputChange para los inputs de texto
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Definición de handleRoleChange para el selector de rol
  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value
    setFormData(prev => ({
      ...prev,
      role: newRole,
      employee_id: newRole !== 'seller' ? undefined : prev.employee_id,
    }))
    if (newRole !== 'seller') {
      setSelectedEmployee(null)
      setSearchTerm("")
    }
  }

  // Definición de handleSubmit para el envío del formulario
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (formData.password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError(null)

    try {
      const userData: CreateUserDto = {
        ...formData,
        permissions: { full_access: formData.role === 'superadmin' || fullAccess },
      }
      await userService.create(userData)
      onUserCreated()
      handleClose()
    } catch (err: any) {
      setError(err.response?.data?.message || "Ocurrió un error al crear el usuario.")
    } finally {
      setLoading(false)
    }
  }

  const allRoles = [
    { value: 'superadmin', label: 'Super Administrador', color: 'bg-purple-500' },
    { value: 'admin', label: 'Administrador', color: 'bg-red-500' },
    { value: 'seller', label: 'Vendedor', color: 'bg-blue-500' },
  ]

  const availableRoles = allRoles.filter(role => {
    if (currentUserRole === 'superadmin') return true
    if (currentUserRole === 'admin') return role.value === 'admin' || role.value === 'seller'
    return false
  })

  useEffect(() => {
    const token = sessionStorage.getItem("token")
    if (token) {
      try {
        const decoded: any = jwtDecode(token)
        setCurrentUserRole(decoded.role || decoded.rol || "seller")
      } catch (e) {
        console.error("Error decoding token:", e)
        setCurrentUserRole("seller")
      }
    }

    const fetchEmployees = async () => {
      try {
        const fetchedEmployees = await employeeService.getAll()
        setEmployees(fetchedEmployees)
      } catch (err) {
        console.error("Error al cargar empleados:", err)
      }
    }
    if (isOpen) {
        fetchEmployees()
    }
  }, [isOpen])

  useEffect(() => {
    // Solo cambia el rol si es distinto al que quieres establecer
    if (
      availableRoles.length > 0 &&
      !availableRoles.some(r => r.value === formData.role)
    ) {
      const firstRole = availableRoles[0].value;
      if (formData.role !== firstRole) {
        setFormData(prev => ({ ...prev, role: firstRole }));
      }
    }
  
    // Solo limpia employee si el rol no es 'seller' y hay algo que limpiar
    if (formData.role !== 'seller') {
      if (selectedEmployee !== null) setSelectedEmployee(null);
      if (formData.employee_id !== undefined) {
        setFormData(prev => ({ ...prev, employee_id: undefined }));
      }
    }
  }, [availableRoles, formData.role, selectedEmployee, formData.employee_id]);
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Nombre Completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese el nombre completo del usuario"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Nombre de Usuario *</label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese el nombre de usuario"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Rol del Usuario *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleRoleChange}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white"
              required
            >
              {availableRoles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {formData.role === 'seller' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Asignar Empleado (Opcional)</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedEmployee(null);
                    setFormData(prev => ({ ...prev, employee_id: undefined }));
                    setIsSuggestionsOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsSuggestionsOpen(false), 150);
                  }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-4 pr-4 py-3 text-white placeholder-slate-400"
                  placeholder="Buscar empleado por nombre o email"
                />
                {isSuggestionsOpen && searchTerm && (
                  <ul className="absolute z-10 w-full bg-slate-700 border border-slate-600 rounded-lg mt-1 max-h-40 overflow-y-auto">
                    {employees.filter(emp => 
                      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map(employee => (
                      <li
                        key={employee.employee_id}
                        className="p-3 hover:bg-slate-600 cursor-pointer text-white"
                        onMouseDown={() => { // Usar onMouseDown para que se dispare antes que el onBlur del input
                          setSelectedEmployee(employee);
                          setFormData(prev => ({ ...prev, employee_id: employee.employee_id }));
                          setSearchTerm(`${employee.first_name} ${employee.last_name}`);
                          setIsSuggestionsOpen(false);
                        }}
                      >
                        {employee.first_name} {employee.last_name} ({employee.email})
                      </li>
                    ))}
                    {employees.filter(emp => 
                      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length === 0 && (
                      <li className="p-3 text-slate-400">No se encontraron empleados.</li>
                    )}
                  </ul>
                )}
                {selectedEmployee && (
                  <p className="text-sm text-slate-400 mt-2">Empleado seleccionado: {selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="fullAccess"
              checked={fullAccess}
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-12 py-3 text-white placeholder-slate-400"
                placeholder="Ingrese la contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Confirmar Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400"
                placeholder="Confirme la contraseña"
                required
              />
            </div>
          </div>

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
}

export default AddUserModal;

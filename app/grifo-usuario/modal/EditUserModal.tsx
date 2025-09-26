
import React, { useState, useEffect } from 'react'
import { X, User, Lock, Mail, UserCheck, Eye, EyeOff } from 'lucide-react'
import userService, { User as ApiUser, UpdateUserDto } from '../../../src/services/userService'

interface EditUserModalProps {
  user: ApiUser | null
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onUserUpdated }) => {
  const [formData, setFormData] = useState<UpdateUserDto>({
    username: '',
    password: '',
    role: 'seller',
    full_name: '',
    is_active: true,
    permissions: {}
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')

  const roles = [
    { value: 'superadmin', label: 'Super Administrador', color: 'bg-purple-500' },
    { value: 'admin', label: 'Administrador', color: 'bg-red-500' },
    { value: 'seller', label: 'Vendedor', color: 'bg-blue-500' },
    { value: 'cashier', label: 'Cajero', color: 'bg-green-500' }
  ]

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '', // No precargar la contraseña por seguridad
        role: user.role || 'seller',
        full_name: user.full_name || '',
        is_active: user.is_active,
        permissions: user.permissions || {}
      })
      setConfirmPassword('')
      setError(null)
    }
  }, [user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleStatusChange = (status: boolean) => {
    setFormData(prev => ({ ...prev, is_active: status }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('No hay usuario seleccionado para editar')
      return
    }

    // Validaciones
    if (!formData.username || !formData.username.trim()) {
      setError('El nombre de usuario es requerido')
      return
    }

    if (formData.password && formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres o dejarla vacía para no cambiarla')
      return
    }

    if (formData.password && formData.password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (!formData.full_name || !formData.full_name.trim()) {
      setError('El nombre completo es requerido')
      return
    }

    try {
      setLoading(true)
      const dataToUpdate: UpdateUserDto = {
        username: formData.username,
        role: formData.role,
        full_name: formData.full_name,
        is_active: formData.is_active,
      }

      if (formData.password && formData.password.trim() !== '') {
        dataToUpdate.password = formData.password
      }

      await userService.update(user.user_id, dataToUpdate)
      
      onUserUpdated()
      onClose()
    } catch (err: any) {
      console.error('Error al actualizar usuario:', err)
      setError(err.message || 'Error al actualizar el usuario')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Editar Usuario</h2>
              <p className="text-sm text-slate-400">Modificar los datos de {user.username}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Nombre Completo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Nombre Completo *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="Ingrese el nombre completo"
                required
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Nombre de Usuario *
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="Ingrese el nombre de usuario"
                required
              />
            </div>
          </div>



          {/* Role */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Rol del Usuario *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              required
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Contraseña (dejar vacío para no cambiar)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-12 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="Ingrese la nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="Confirme la nueva contraseña"
              />
            </div>
          </div>

          {/* Estado del Usuario */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Estado del Usuario
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleStatusChange(true)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${formData.is_active ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(false)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${!formData.is_active ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                Inactivo
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </div>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditUserModal




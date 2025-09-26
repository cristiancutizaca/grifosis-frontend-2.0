'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Calendar, MapPin, Phone, Mail, Briefcase, Hash } from 'lucide-react'
import EmployeeService, { CreateEmployeeDto } from '../../../src/services/employeeService'

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onEmployeeCreated: () => void
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onEmployeeCreated }) => {
  const [formData, setFormData] = useState<CreateEmployeeDto>({
    dni: '',
    first_name: '',
    last_name: '',
    position: 'Vendedor',
    birth_date: '',
    address: '',
    phone_number: '',
    email: '',
    hire_date: new Date().toISOString().split('T')[0],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resetear formulario cuando se abre/cierra el modal
  useEffect(() => {
    if (isOpen) {
      setFormData({
        dni: '',
        first_name: '',
        last_name: '',
        position: 'Vendedor',
        birth_date: '',
        address: '',
        phone_number: '',
        email: '',
        hire_date: new Date().toISOString().split('T')[0],
      })
      setError(null)
    }
  }, [isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = (): boolean => {
    // Validaciones básicas
    if (!formData.dni.trim()) {
      setError('El DNI es requerido')
      return false
    }
    
    if (!/^\d{8}$/.test(formData.dni.trim())) {
      setError('El DNI debe tener exactamente 8 dígitos')
      return false
    }

    if (!formData.first_name.trim()) {
      setError('El nombre es requerido')
      return false
    }

    if (!formData.last_name.trim()) {
      setError('El apellido es requerido')
      return false
    }

    if (!formData.email.trim()) {
      setError('El email es requerido')
      return false
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      setError('El formato del email no es válido')
      return false
    }

    if (!formData.phone_number.trim()) {
      setError('El teléfono es requerido')
      return false
    }

    if (!/^\d{9}$/.test(formData.phone_number.trim())) {
      setError('El teléfono debe tener exactamente 9 dígitos')
      return false
    }

    if (!formData.birth_date) {
      setError('La fecha de nacimiento es requerida')
      return false
    }

    if (!formData.address.trim()) {
      setError('La dirección es requerida')
      return false
    }

    if (!formData.hire_date) {
      setError('La fecha de contratación es requerida')
      return false
    }

    // Validar que la fecha de nacimiento no sea futura
    const birthDate = new Date(formData.birth_date)
    const today = new Date()
    if (birthDate > today) {
      setError('La fecha de nacimiento no puede ser futura')
      return false
    }

    // Validar que la persona sea mayor de edad (18 años)
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (age < 18 || (age === 18 && monthDiff < 0) || (age === 18 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      setError('El empleado debe ser mayor de edad (18 años)')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      console.log('Creando empleado:', formData)
      
      await EmployeeService.create(formData)
      
      onEmployeeCreated()
      handleClose()
    } catch (err: any) {
      console.error('Error al crear empleado:', err)
      let userFriendlyMessage = 'Error al crear el empleado.';

      // Manejo específico para el error de DNI duplicado de la base de datos
      if (err.message && typeof err.message === 'string') {
        if (err.message.includes('llave duplicada viola restricción de unicidad') || err.message.includes('Ya existe la llave (dni)')) {
          userFriendlyMessage = 'Error: El DNI ingresado ya está registrado. Por favor, ingrese un DNI diferente.';
        } else {
          // Si es otro tipo de error del backend, muestra el mensaje original
          userFriendlyMessage = err.message;
        }
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      dni: '',
      first_name: '',
      last_name: '',
      position: 'Vendedor',
      birth_date: '',
      address: '',
      phone_number: '',
      email: '',
      hire_date: new Date().toISOString().split('T')[0],
    })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agregar Nuevo Empleado</h2>
              <p className="text-sm text-slate-400">Complete la información del nuevo empleado</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              {/* DNI */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">DNI *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="dni"
                    value={formData.dni}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="12345678"
                    maxLength={8}
                    required
                  />
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Nombre *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ingrese el nombre"
                    required
                  />
                </div>
              </div>

              {/* Apellido */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Apellido *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ingrese el apellido"
                    required
                  />
                </div>
              </div>

              {/* Posición */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Posición *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                    required
                  >
                    <option value="Vendedor">Vendedor</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Fecha de Nacimiento */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Fecha de Nacimiento *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="ejemplo@correo.com"
                    required
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Teléfono *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="987654321"
                    maxLength={9}
                    required
                  />
                </div>
              </div>

              {/* Dirección */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Dirección *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    placeholder="Ingrese la dirección completa"
                    required
                  />
                </div>
              </div>

              {/* Fecha de Contratación */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Fecha de Contratación *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    name="hire_date"
                    value={formData.hire_date}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-orange-300 mb-2">Información importante:</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• El empleado se creará directamente en la tabla de empleados</li>
              <li>• El DNI debe ser único y tener exactamente 8 dígitos</li>
              <li>• El teléfono debe tener exactamente 9 dígitos</li>
              <li>• El empleado debe ser mayor de edad (18 años)</li>
              <li>• Todos los campos marcados con (*) son obligatorios</li>
              <li>• El empleado se creará como activo por defecto</li>
            </ul>
          </div>

          {/* Botones */}
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
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creando...</span>
                </div>
              ) : (
                'Crear Empleado'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddEmployeeModal

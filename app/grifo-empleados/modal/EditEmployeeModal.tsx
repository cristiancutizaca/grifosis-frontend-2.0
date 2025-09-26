'use client'

import React, { useState, useEffect } from 'react';
import { X, User, Calendar, MapPin, Phone, Mail, Briefcase, Hash } from 'lucide-react';
import { Employee as BackendEmployee, UpdateEmployeeDto } from '../../../src/services/employeeService';

interface EditEmployeeModalProps {
    employee: BackendEmployee | null;
    onClose: () => void;
    onSave: (id: number, data: UpdateEmployeeDto) => Promise<void>;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ employee, onClose, onSave }) => {
    const [editingEmployee, setEditingEmployee] = useState<BackendEmployee | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (employee) {
            // Cuando se abre el modal o cambia el empleado, inicializamos el estado de edición
            // Formatear las fechas a YYYY-MM-DD para los inputs de tipo "date"
            setEditingEmployee({
                ...employee,
                birth_date: employee.birth_date ? new Date(employee.birth_date).toISOString().split('T')[0] : '',
                hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : '',
                // termination_date: employee.termination_date ? new Date(employee.termination_date).toISOString().split('T')[0] : '',
            });
            setError(null);
        }
    }, [employee]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditingEmployee(prev => {
            if (!prev) return null;
            if (name === 'status') {
                return { ...prev, is_active: value === 'Activo' };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleSave = async () => {
        if (!editingEmployee) return;

        setError(null);
        setLoading(true);

        try {
            // Construimos el DTO de actualización con los campos que el backend espera
            // Las fechas ya están en YYYY-MM-DD gracias al useEffect y los inputs
            const updateData: UpdateEmployeeDto = {
                dni: editingEmployee.dni,
                first_name: editingEmployee.first_name,
                last_name: editingEmployee.last_name,
                position: editingEmployee.position,
                birth_date: editingEmployee.birth_date,
                address: editingEmployee.address,
                phone_number: editingEmployee.phone_number,
                email: editingEmployee.email,
                hire_date: editingEmployee.hire_date,
                is_active: editingEmployee.is_active,
                // termination_date: editingEmployee.termination_date // Incluir si es necesario y está en el DTO
            };

            await onSave(editingEmployee.employee_id, updateData);
            onClose();
        } catch (err: any) {
            console.error("Error al guardar cambios del empleado:", err);
            let userFriendlyMessage = "Hubo un error al guardar los cambios. Intente de nuevo.";

            if (err.message && typeof err.message === 'string') {
                if (err.message.includes('llave duplicada viola restricción de unicidad') || err.message.includes('Ya existe la llave (dni)')) {
                    userFriendlyMessage = 'Error: El DNI ingresado ya está registrado para otro empleado.';
                } else if (err.message.includes('Validation failed')) {
                    // Si usas ValidationPipe en el backend y devuelve mensajes específicos
                    userFriendlyMessage = `Error de validación: ${err.message.split(': ')[1] || 'Verifique los datos ingresados.'}`;
                } else {
                    userFriendlyMessage = err.message;
                }
            }
            setError(userFriendlyMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setEditingEmployee(null);
        onClose();
    };

    if (!employee || !editingEmployee) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header del Modal */}
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                                {editingEmployee.first_name.charAt(0)}{editingEmployee.last_name.charAt(0)}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                Editar Empleado
                            </h2>
                            <p className="text-sm text-slate-400">
                                {editingEmployee.first_name} {editingEmployee.last_name}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Contenido del Modal */}
                <div className="p-6">
                    {/* Mensaje de error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Información de fechas */}
                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600 mb-6">
                        <div className="text-xs text-slate-400 space-y-1">
                            <p className="flex items-center gap-2">
                                📅 <span className="font-medium">Creado:</span>
                                <span className="text-slate-300">
                                    {new Date(editingEmployee.created_at ?? '').toLocaleString('es-PE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </p>
                            <p className="flex items-center gap-2">
                                🔄 <span className="font-medium">Actualizado:</span>
                                <span className="text-slate-300">
                                    {new Date(editingEmployee.updated_at ?? '').toLocaleString('es-PE', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Formulario */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Columna izquierda */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">DNI</label>
                                <input
                                    type="text"
                                    value={editingEmployee.dni || ''}
                                    onChange={handleChange}
                                    name="dni"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    maxLength={8}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre</label>
                                <input
                                    type="text"
                                    value={editingEmployee.first_name || ''}
                                    onChange={handleChange}
                                    name="first_name"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Apellido</label>
                                <input
                                    type="text"
                                    value={editingEmployee.last_name || ''}
                                    onChange={handleChange}
                                    name="last_name"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de Nacimiento</label>
                                <input
                                    type="date"
                                    value={editingEmployee.birth_date || ''} // Ya formateado en useEffect
                                    onChange={handleChange}
                                    name="birth_date"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Dirección</label>
                                <textarea
                                    value={editingEmployee.address || ''}
                                    onChange={handleChange}
                                    name="address"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>

                        {/* Columna derecha */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={editingEmployee.email || ''}
                                    onChange={handleChange}
                                    name="email"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
                                <input
                                    type="text"
                                    value={editingEmployee.phone_number || ''}
                                    onChange={handleChange}
                                    name="phone_number"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    maxLength={9}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de Contratación</label>
                                <input
                                    type="date"
                                    value={editingEmployee.hire_date || ''} // Ya formateado en useEffect
                                    onChange={handleChange}
                                    name="hire_date"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Posición</label>
                                <select
                                    value={editingEmployee.position}
                                    onChange={handleChange}
                                    name="position"
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none"
                                >
                                    <option value="Vendedor">Vendedor</option>
                                    <option value="Cajero">Cajero</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Gerente">Gerente</option>
                                    <option value="Administrador">Administrador</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-3">Estado</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                                            editingEmployee.is_active
                                                ? 'bg-green-500 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                                        }`}
                                        onClick={() =>
                                            setEditingEmployee({ ...editingEmployee, is_active: true })
                                        }
                                    >
                                        Activo
                                    </button>
                                    <button
                                        type="button"
                                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                                            !editingEmployee.is_active
                                                ? 'bg-red-500 text-white shadow-lg'
                                                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                                        }`}
                                        onClick={() =>
                                            setEditingEmployee({ ...editingEmployee, is_active: false })
                                        }
                                    >
                                        Inactivo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Sección de archivos (sin cambios en la lógica de archivos, solo UI) */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Documentos Adjuntos (Opcional)</label>
                            <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center bg-slate-700/30">
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => {
                                        const newFiles = Array.from(e.target.files ?? []);
                                        setEditingEmployee((prev) => ({
                                            ...prev!,
                                            // No hay campo 'files' en BackendEmployee, esto causaría un error de tipo
                                            // Si necesitas manejar archivos, deberías añadir 'files?: File[];' a BackendEmployee
                                            // o manejar los archivos por separado. Por ahora, esto causaría un error de tipo.
                                            // Para que compile, lo comentaré o lo adaptaré si BackendEmployee lo permite.
                                            // files: [...(prev?.files ?? []), ...newFiles], // Esto asume que BackendEmployee tiene 'files'
                                        }));
                                    }}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <div className="text-slate-400 mb-2">
                                        <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        <span className="font-medium text-orange-400">Haz clic para subir</span> o arrastra archivos aquí
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX hasta 10MB</div>
                                </label>
                            </div>
                        </div>

                        {/* Lista de archivos (comentada la parte que asume 'files' en BackendEmployee) */}
                        {/* {editingEmployee.files && editingEmployee.files.length > 0 && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">Archivos Adjuntos:</label>
                                <div className="space-y-2">
                                    {editingEmployee.files.map((file, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg border border-slate-600"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <span className="text-white text-sm truncate max-w-xs">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={URL.createObjectURL(file)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                                                >
                                                    Ver
                                                </a>
                                                <button
                                                    onClick={() => {
                                                        const updatedFiles = [...(editingEmployee.files ?? [])];
                                                        updatedFiles.splice(index, 1);
                                                        setEditingEmployee({
                                                            ...editingEmployee,
                                                            files: updatedFiles,
                                                        });
                                                    }}
                                                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )} */}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-slate-700">
                        <button 
                            onClick={handleClose}
                            className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors shadow-lg disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed"
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
                </div>
            </div>
        </div>
    );
};

export default EditEmployeeModal;

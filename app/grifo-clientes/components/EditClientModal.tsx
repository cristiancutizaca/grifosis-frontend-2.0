'use client';

import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import clientService, { Client, UpdateClientData } from '../../../src/services/clientService';

interface EditClientModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onSave: (updatedClient: Client) => Promise<void>;
}

const CATEGORIES = [
  { value: "credito", label: "Crédito" },
  { value: "contado", label: "Contado" },
  { value: "frecuente", label: "Frecuente" },
  { value: "moroso", label: "Moroso" },
];

const EditClientModal: React.FC<EditClientModalProps> = ({
  isOpen,
  client,
  onClose,
  onSave,
}) => {
  // ¡Ahora soporta valores iniciales vacíos!
  const [formData, setFormData] = useState<UpdateClientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actualiza datos cuando cambia el cliente seleccionado
  useEffect(() => {
    if (client && client.client_id) {
      setFormData({
        client_id: client.client_id,
        first_name: client.first_name ?? '',
        last_name: client.last_name ?? '',
        company_name: client.company_name ?? '',
        category: client.category ?? '',
        document_type: client.document_type ?? 'DNI',
        document_number: client.document_number ?? '',
        address: client.address ?? '',
        phone: client.phone ?? '',
        email: client.email ?? '',
        birth_date: client.birth_date
          ? new Date(client.birth_date).toISOString().split('T')[0]
          : null,
        notes: client.notes ?? '',
        client_type: client.client_type ?? 'persona',
      });
      setError(null);
    } else {
      setFormData(null);
    }
  }, [client]);

  const handleInputChange = (
    field: keyof UpdateClientData,
    value: any
  ) => {
    setFormData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !formData.client_id || formData.client_id === 0) {
      setError('ID inválido para edición.');
      return;
    }
    if (formData.client_type === 'persona') {
      if (!formData.first_name?.trim()) {
        setError('El nombre es obligatorio');
        return;
      }
      if (!formData.last_name?.trim()) {
        setError('El apellido es obligatorio');
        return;
      }
    }
    if (formData.client_type === 'empresa' && !formData.company_name?.trim()) {
      setError('La razón social es obligatoria');
      return;
    }
    if (!formData.document_number?.trim()) {
      setError('El número de documento es obligatorio');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Armar payload limpio (sólo campos necesarios)
      const payload: UpdateClientData = {
        ...formData,
        // fuerza todos los string obligatorios a string
        first_name: formData.first_name ? String(formData.first_name) : undefined,
        last_name: formData.last_name ? String(formData.last_name) : undefined,
        company_name: formData.company_name ? String(formData.company_name) : undefined,
        category: formData.category ? String(formData.category) : undefined,
        document_type: formData.document_type ? String(formData.document_type) : undefined,
        document_number: formData.document_number ? String(formData.document_number) : undefined,
        address: formData.address ? String(formData.address) : undefined,
        phone: formData.phone ? String(formData.phone) : undefined,
        email: formData.email ? String(formData.email) : undefined,
        birth_date:
          !formData.birth_date || formData.birth_date.trim() === ''
            ? null
            : String(formData.birth_date),
        notes: formData.notes ? String(formData.notes) : undefined,
        client_type: formData.client_type === 'persona' || formData.client_type === 'empresa'
          ? formData.client_type
          : 'persona',
      };

      const updated = await clientService.updateClient(payload);
      await onSave(updated);
      setError(null);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        'Error al actualizar el cliente. Verifica los datos.'
      );
      console.error('Error updating client:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !formData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <User className="mr-2" size={24} />
            Editar Cliente
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-500 text-white p-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.client_type === 'persona' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={formData.first_name ?? ''}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Ingrese el nombre"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Apellido *</label>
                  <input
                    type="text"
                    value={formData.last_name ?? ''}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Ingrese el apellido"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Razón Social *</label>
                <input
                  type="text"
                  value={formData.company_name ?? ''}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Empresa"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
              <select
                value={formData.category ?? ''}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                required
              >
                <option value="">Seleccione una categoría</option>
                {CATEGORIES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de documento</label>
              <select
                value={formData.document_type ?? 'DNI'}
                onChange={(e) => handleInputChange('document_type', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Extranjeria">Carnet de Extranjería</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Número de documento *</label>
              <input
                type="text"
                value={formData.document_number ?? ''}
                onChange={(e) => handleInputChange('document_number', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el número de documento"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dirección</label>
              <input
                type="text"
                value={formData.address ?? ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Dirección"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.phone ?? ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Teléfono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email ?? ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={formData.birth_date ?? ''}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Fecha de nacimiento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
              <textarea
                value={formData.notes ?? ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Observaciones o notas"
                rows={2}
              />
            </div>
          </div>

          <div className="flex space-x-4 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClientModal;

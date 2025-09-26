'use client';

import React, { useState } from 'react';
import { X, User } from 'lucide-react';
import clientService, { CreateClientData } from '../../../src/services/clientService';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: any) => void;
}

// Inicializa los campos según la entidad de tu backend
const initialForm: CreateClientData = {
  first_name: '',
  last_name: '',
  company_name: '',
  category: '',
  document_type: 'DNI',
  document_number: '',
  address: '',
  phone: '',
  email: '',
  birth_date: '',
  notes: '',
  client_type: 'persona',
};

const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const [formData, setFormData] = useState<CreateClientData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    field: keyof CreateClientData,
    value: any
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones básicas
    if (!formData.first_name?.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!formData.last_name?.trim()) {
      setError('El apellido es obligatorio');
      return;
    }
    if (!formData.document_number?.trim()) {
      setError('El número de documento es obligatorio');
      return;
    }


    try {
      setLoading(true);
      setError(null);

      // Envía todos los campos según la entidad y tabla de backend
      const dataToSend: CreateClientData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        company_name: formData.company_name || undefined,
        category: formData.category || undefined,
        document_type: formData.document_type,
        document_number: formData.document_number,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        birth_date: formData.birth_date || undefined,
        notes: formData.notes || undefined,
        client_type: formData.client_type,
      };

      const newClient = await clientService.createClient(dataToSend);
      onClientCreated(newClient);

      setFormData(initialForm);
      onClose();
    } catch (err) {
      setError('Error al crear el cliente. Verifica los datos o que el documento no esté duplicado.');
      console.error('Error creating client:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <User className="mr-2" size={24} />
            Crear Nuevo Cliente
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
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
              <input
                type="text"
                value={formData.first_name}
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
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el apellido"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre de la empresa</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Empresa (si aplica)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Categoría (opcional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de documento</label>
              <select
                value={formData.document_type}
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
                value={formData.document_number}
                onChange={(e) => handleInputChange('document_number', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el número de documento"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dirección</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese la dirección"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el teléfono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Fecha de nacimiento</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => handleInputChange('birth_date', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Fecha de nacimiento"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              placeholder="Observaciones o notas"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de cliente</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="persona"
                  checked={formData.client_type === 'persona'}
                  onChange={(e) => handleInputChange('client_type', e.target.value)}
                  className="mr-2"
                />
                <span className="text-white">Persona Natural</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="empresa"
                  checked={formData.client_type === 'empresa'}
                  onChange={(e) => handleInputChange('client_type', e.target.value)}
                  className="mr-2"
                />
                <span className="text-white">Empresa</span>
              </label>
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
              {loading ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClientModal;

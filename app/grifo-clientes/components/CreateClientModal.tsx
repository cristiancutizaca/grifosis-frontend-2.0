'use client';

import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import clientService, { CreateClientData } from '../../../src/services/clientService';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: any) => void;
}

// Categorías válidas (las del check de tu BD)
export const CATEGORIES = [
  { value: 'credito', label: 'Crédito' },
  { value: 'contado', label: 'Contado' },
  { value: 'frecuente', label: 'Frecuente' },
  { value: 'moroso', label: 'Moroso' },
];

// ---- Utilidades: límites + sanitizador que acepta undefined ----
const DOC_LIMITS = { DNI: 8, RUC: 11 } as const;
type DocKey = keyof typeof DOC_LIMITS;

function getDocMax(docType?: string): number {
  const key = (docType ?? 'DNI') as DocKey;
  return DOC_LIMITS[key] ?? 20;
}

function sanitizeDocNumber(docType: string | undefined, raw: string) {
  const onlyDigits = (raw ?? '').replace(/\D/g, '');
  const max = getDocMax(docType);
  return onlyDigits.slice(0, max);
}
// ---------------------------------------------------------------

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
  client_type: 'persona', // Por defecto persona
};

const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const [formData, setFormData] = useState<CreateClientData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData(initialForm);
    setError(null);
  };

  const handleInputChange = (field: keyof CreateClientData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones mínimas
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
    if (!formData.category) {
      setError('La categoría es obligatoria');
      return;
    }
    if (!formData.document_number?.trim()) {
      setError('El número de documento es obligatorio');
      return;
    }

    // Validación específica por tipo de documento
    const docType = formData.document_type ?? 'DNI';
    const doc = String(formData.document_number || '');
    if (!/^\d+$/.test(doc)) {
      setError('El número de documento solo debe contener dígitos.');
      return;
    }
    if (docType === 'DNI' && doc.length !== DOC_LIMITS.DNI) {
      setError('El DNI debe tener exactamente 8 dígitos.');
      return;
    }
    if (docType === 'RUC' && doc.length !== DOC_LIMITS.RUC) {
      setError('El RUC debe tener exactamente 11 dígitos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Solo permite 'persona' o 'empresa'
      const clientType: 'persona' | 'empresa' =
        formData.client_type === 'persona' || formData.client_type === 'empresa'
          ? formData.client_type
          : 'persona';

      const dataToSend: CreateClientData = {
        first_name: clientType === 'persona' ? String(formData.first_name ?? '') : undefined,
        last_name: clientType === 'persona' ? String(formData.last_name ?? '') : undefined,
        company_name: clientType === 'empresa' ? String(formData.company_name ?? '') : undefined,
        category: String(formData.category ?? ''),
        document_type: String(docType),
        document_number: String(formData.document_number ?? ''),
        address: formData.address ? String(formData.address) : undefined,
        phone: formData.phone ? String(formData.phone) : undefined,
        email: formData.email ? String(formData.email) : undefined,
        birth_date: formData.birth_date ? String(formData.birth_date) : undefined,
        notes: formData.notes ? String(formData.notes) : undefined,
        client_type: clientType,
      };

      const newClient = await clientService.createClient(dataToSend);
      onClientCreated(newClient);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'Error al crear el cliente. Verifica los datos o que el documento no esté duplicado.'
      );
      console.error('Error creating client:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        resetForm();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const docType = formData.document_type ?? 'DNI';
  const currentMax = getDocMax(docType);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => {
        resetForm();
        onClose();
      }}
    >
      {/* detener propagación para no cerrar al hacer click dentro */}
      <div
        className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <User className="mr-2" size={24} />
            Crear Nuevo Cliente
          </h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {error && <div className="mx-6 mt-4 bg-red-500 text-white p-3 rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Persona / Empresa (nombres o razón social) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.client_type === 'persona' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="Ingrese el nombre"
                    required={formData.client_type === 'persona'}
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
                    required={formData.client_type === 'persona'}
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
                  placeholder="Nombre de la empresa"
                  required={formData.client_type === 'empresa'}
                />
              </div>
            )}
          </div>

          {/* Categoría, Tipo doc, Número doc */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Categoría *</label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                required
              >
                <option value="">Seleccione una categoría</option>
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de documento</label>
              <select
                value={docType}
                onChange={(e) => {
                  const newType = e.target.value;
                  handleInputChange('document_type', newType);
                  setFormData((prev) => ({
                    ...prev,
                    document_number: sanitizeDocNumber(newType, prev.document_number || ''),
                  }));
                }}
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
                onChange={(e) =>
                  handleInputChange('document_number', sanitizeDocNumber(docType, e.target.value))
                }
                inputMode="numeric"
                pattern="\d*"
                maxLength={currentMax}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder={
                  docType === 'DNI'
                    ? 'Ingrese 8 dígitos'
                    : docType === 'RUC'
                    ? 'Ingrese 11 dígitos'
                    : 'Ingrese el número de documento'
                }
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                {docType === 'DNI' && 'Debe tener 8 dígitos.'}
                {docType === 'RUC' && 'Debe tener 11 dígitos.'}
              </p>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Dirección</label>
              <input
                type="text"
                value={formData.address ?? ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese la dirección"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.phone ?? ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el teléfono"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email ?? ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="Ingrese el email"
              />
            </div>

            {/* Fecha de nacimiento */}
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

            {/* Notas */}
            <div className="md:col-span-2">
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

          {/* Tipo de cliente */}
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

          {/* Botones */}
          <div className="flex space-x-4 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
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

// app/grifo-clientes/ClientsContent.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Gauge as LimitsIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import CreateClientModal, { CATEGORIES } from './components/CreateClientModal';
import EditClientModal from './components/EditClientModal';
import ClientLimitsModal from './components/ClientLimitsModal';

import clientService, { Client } from '../../src/services/clientService';
import productService, { Product } from '../../src/services/productService';
import { getUserRole } from '../../src/utils/auth';
import { listClientLimits } from '../../src/services/clientLimitsService';

/* =================== helpers de permisos =================== */
const hasClientPermission = (
  action: 'create' | 'edit' | 'delete',
  userRole: string | null
): boolean => {
  if (!userRole) return false;
  switch (action) {
    case 'create':
      return true;
    case 'edit':
    case 'delete':
      return userRole === 'admin' || userRole === 'superadmin';
    default:
      return false;
  }
};

const getTipoCliente = (client: Client) => {
  const raw =
    (client as any).client_type ??
    (client as any).tipo_cliente ??
    (client as any).type ??
    (client as any).clientType ??
    client.client_type;
  return raw === 'empresa' ? 'empresa' : 'persona';
};

/* =================== componente principal =================== */
const ClientsContent: React.FC = () => {
  // estado principal
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [selectedClientType, setSelectedClientType] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // productos para modal de límites
  const [products, setProducts] = useState<Product[]>([]);
  // modal límites
  const [limitsClientId, setLimitsClientId] = useState<number | null>(null);
  const [limitsClientName, setLimitsClientName] = useState<string | undefined>();

  // contenedor scrollable de la tabla
  const tableWrapRef = useRef<HTMLDivElement>(null);

  // cargar datos iniciales
  useEffect(() => {
    const role = getUserRole();
    setCurrentUserRole(role);

    (async () => {
      try {
        const [data, prods] = await Promise.all([
          clientService.getAllClients(),
          productService.getProducts(),
        ]);
        setClients(Array.isArray(data) ? data : []);
        setProducts(Array.isArray(prods) ? prods : []);
      } catch {
        alert('Error cargando clientes o productos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // crear cliente
  const handleCreateClient = (newClient: Client) => {
    setClients((prev) => [...prev, newClient]);
    setShowCreateModal(false);
  };

  // guardar edición
  const handleSaveClient = async (updatedClient: Client) => {
    if (!hasClientPermission('edit', currentUserRole)) {
      alert('No tiene permisos para editar clientes.');
      return;
    }
    try {
      const clientType: 'persona' | 'empresa' =
        getTipoCliente(updatedClient) === 'empresa' ? 'empresa' : 'persona';

      const dataToSend = {
        ...updatedClient,
        client_type: clientType,
        first_name: updatedClient.first_name ? String(updatedClient.first_name) : '',
        last_name: updatedClient.last_name ? String(updatedClient.last_name) : '',
        company_name: updatedClient.company_name ? String(updatedClient.company_name) : '',
        category: updatedClient.category ? String(updatedClient.category) : '',
        document_type: updatedClient.document_type ? String(updatedClient.document_type) : '',
        document_number: updatedClient.document_number ? String(updatedClient.document_number) : '',
        address: updatedClient.address ? String(updatedClient.address) : '',
        phone: updatedClient.phone ? String(updatedClient.phone) : '',
        email: updatedClient.email ? String(updatedClient.email) : '',
        birth_date: updatedClient.birth_date ? String(updatedClient.birth_date) : undefined,
        notes: updatedClient.notes ? String(updatedClient.notes) : '',
      };

      const updated = await clientService.updateClient({
        ...dataToSend,
        client_id: (updatedClient as any).client_id,
      });

      setClients((prev) =>
        prev.map((c) => ((c as any).client_id === (updated as any).client_id ? (updated as Client) : c))
      );
      setEditingClient(null);
    } catch {
      alert('Error actualizando cliente');
    }
  };

  // eliminar
  const handleDeleteClient = async (clientId: number) => {
    if (!hasClientPermission('delete', currentUserRole)) {
      alert('No tiene permisos para eliminar clientes.');
      return;
    }
    if (!window.confirm('¿Seguro que deseas eliminar este cliente?')) return;
    try {
      await clientService.deleteClient(clientId);
      setClients((prev) => prev.filter((c) => (c as any).client_id !== clientId));
    } catch {
      alert('Error eliminando cliente');
    }
  };

  // filtro
  const filteredClients = useMemo(() => {
    const st = searchTerm.trim().toLowerCase();
    return clients.filter((client) => {
      const firstName = (client as any).first_name ?? (client as any).nombre ?? '';
      const lastName = (client as any).last_name ?? (client as any).apellido ?? '';
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      const document = ((client as any).document_number ?? (client as any).documento ?? '').toLowerCase();
      const matchesSearch = !st || fullName.includes(st) || document.includes(st);
      const matchesCategory = selectedFilter === '' || (client as any).category === selectedFilter;
      const matchesClientType = selectedClientType === '' || getTipoCliente(client) === selectedClientType;
      return matchesSearch && matchesCategory && matchesClientType;
    });
  }, [clients, searchTerm, selectedFilter, selectedClientType]);

  // navegación horizontal: clic, mantener, doble clic
  const scrollByChunk = (dir: 'left' | 'right') => {
    const el = tableWrapRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.8) * (dir === 'left' ? -1 : 1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAutoScroll = (dir: 'left' | 'right') => {
    if (autoScrollTimer.current) return;
    const el = tableWrapRef.current;
    if (!el) return;
    autoScrollTimer.current = setInterval(() => {
      el.scrollLeft += (dir === 'left' ? -1 : 1) * Math.max(8, Math.floor(el.clientWidth * 0.02));
    }, 16);
  };
  const stopAutoScroll = () => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  };
  const jumpToEdge = (edge: 'start' | 'end') => {
    const el = tableWrapRef.current;
    if (!el) return;
    el.scrollTo({ left: edge === 'start' ? 0 : el.scrollWidth, behavior: 'smooth' });
  };

  // rueda vertical => scroll horizontal (sobre la tabla)
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      const mainlyVertical = Math.abs(ev.deltaY) > Math.abs(ev.deltaX);
      if (mainlyVertical) {
        el.scrollLeft += ev.deltaY;
        ev.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as any);
  }, []);

  // atajos de teclado (opcional)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key.toLowerCase() === 'a') scrollByChunk('left');
      if (e.key.toLowerCase() === 'd') scrollByChunk('right');
      if (e.key === 'Home') jumpToEdge('start');
      if (e.key === 'End') jumpToEdge('end');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return <div className="text-white text-center py-10">Cargando clientes...</div>;
  }

  const canCreate = hasClientPermission('create', currentUserRole);
  const canEdit = hasClientPermission('edit', currentUserRole);
  const canDelete = hasClientPermission('delete', currentUserRole);

  return (
    <div className="p-3 sm:p-4 lg:p-6 lg:space-y-6">
      {/* Header */}
      <button
        className={`bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
          canCreate ? '' : 'opacity-50 cursor-not-allowed'
        }`}
        onClick={() => canCreate && setShowCreateModal(true)}
        disabled={!canCreate}
        title={canCreate ? 'Añadir nuevo cliente' : 'No tiene permisos para crear clientes'}
      >
        <Plus size={20} />
        <span>Añadir nuevo cliente</span>
      </button>

      {/* Modal crear */}
      {showCreateModal && (
        <CreateClientModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onClientCreated={handleCreateClient}
        />
      )}

      {/* Modal editar */}
      <EditClientModal
        isOpen={!!editingClient}
        client={editingClient}
        onClose={() => setEditingClient(null)}
        onSave={handleSaveClient}
      />

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <label className="block text-slate-400 text-sm mb-1">Buscar</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nombre o documento"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Tipo de Categoría</label>
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="">Todos</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Tipo de Cliente</label>
          <select
            value={selectedClientType}
            onChange={(e) => setSelectedClientType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="">Todos</option>
            <option value="persona">Persona</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>
      </div>

      {/* Barra de navegación horizontal (arriba, sticky) */}
      <div className="sticky top-[84px] z-20 ml-auto flex items-center justify-end gap-2 sm:gap-3">
        <button
          onClick={() => scrollByChunk('left')}
          onMouseDown={() => startAutoScroll('left')}
          onMouseUp={stopAutoScroll}
          onMouseLeave={stopAutoScroll}
          onDoubleClick={() => jumpToEdge('start')}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-700/70 hover:bg-slate-600 px-2 py-1 text-white"
          title="Ir a la izquierda (clic: 80% / mantener: continuo / doble clic: inicio)"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => scrollByChunk('right')}
          onMouseDown={() => startAutoScroll('right')}
          onMouseUp={stopAutoScroll}
          onMouseLeave={stopAutoScroll}
          onDoubleClick={() => jumpToEdge('end')}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-700/70 hover:bg-slate-600 px-2 py-1 text-white"
          title="Ir a la derecha (clic: 80% / mantener: continuo / doble clic: fin)"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto" ref={tableWrapRef}>
              <table className="w-full min-w-[980px]">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-700 text-left py-3 px-4 text-slate-300 font-medium">
                      Nombres y Apellidos
                    </th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Documento</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Tipo de Cliente</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Categoría</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Teléfono</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Correo</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Límite Crédito</th>
                    <th className="sticky right-0 z-10 bg-slate-700 text-left py-3 px-4 text-slate-300 font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const tipo = getTipoCliente(client);
                    const nombre =
                      tipo === 'persona'
                        ? `${(client as any).first_name ?? (client as any).nombre ?? ''} ${
                            (client as any).last_name ?? (client as any).apellido ?? ''
                          }`.trim()
                        : (client as any).company_name || (client as any).nombre || '';
                    return (
                      <tr
                        key={(client as any).client_id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30"
                      >
                        <td className="sticky left-0 bg-slate-800/80 backdrop-blur px-4 py-3 text-white z-10">
                          {nombre}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {(client as any).document_number ?? (client as any).documento ?? ''}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              tipo === 'persona'
                                ? 'bg-orange-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}
                          >
                            {tipo === 'persona' ? 'Natural' : 'Empresa'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{(client as any).category || '---'}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {(client as any).phone ?? (client as any).telefono ?? ''}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{(client as any).email ?? ''}</td>

                        {/* Límite Crédito: cantidad de límites activos */}
                        <td className="py-3 px-4">
                          <ActiveLimitsCell clientId={(client as any).client_id} />
                        </td>

                        <td className="sticky right-0 bg-slate-800/80 backdrop-blur px-4 py-2 z-10">
                          <div className="flex items-center justify-end gap-2">
                            {/* Editar */}
                            <button
                              onClick={() => canEdit && setEditingClient(client)}
                              disabled={!canEdit}
                              className={`text-blue-500 flex items-center ${
                                canEdit ? 'hover:text-blue-600' : 'opacity-50 cursor-not-allowed'
                              }`}
                              title={canEdit ? 'Editar cliente' : 'No tiene permisos para editar'}
                            >
                              <EditIcon />
                            </button>

                            {/* Eliminar */}
                            <button
                              onClick={() => canDelete && handleDeleteClient((client as any).client_id)}
                              disabled={!canDelete}
                              className={`text-red-500 flex items-center ${
                                canDelete ? 'hover:text-red-600' : 'opacity-50 cursor-not-allowed'
                              }`}
                              title={canDelete ? 'Eliminar cliente' : 'No tiene permisos para eliminar'}
                            >
                              <DeleteIcon />
                            </button>

                            {/* Límites por producto */}
                            <button
                              onClick={() => {
                                if (!canEdit) return;
                                setLimitsClientId((client as any).client_id);
                                setLimitsClientName(nombre);
                              }}
                              disabled={!canEdit}
                              className={`text-emerald-400 flex items-center ${
                                canEdit ? 'hover:text-emerald-500' : 'opacity-50 cursor-not-allowed'
                              }`}
                              title={
                                canEdit
                                  ? 'Configurar límites por producto'
                                  : 'No tiene permisos para configurar límites'
                              }
                            >
                              <LimitsIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination si la necesitas */}
          </div>
        </div>
      </div>

      {/* Modal de Límites */}
      {limitsClientId !== null && (
        <ClientLimitsModal
          clientId={limitsClientId}
          clientName={limitsClientName}
          products={products.map((p) => ({
            product_id: (p as any).product_id,
            name: (p as any).name,
          }))}
          onClose={() => setLimitsClientId(null)}
        />
      )}
    </div>
  );
};

export default ClientsContent;

/* =================== Auxiliar: celda de límite =================== */
function ActiveLimitsCell({ clientId }: { clientId: number }) {
  const [text, setText] = useState<string>('—');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Usa el flag correcto del service: { active: true }
        const rows = await listClientLimits(clientId, { active: true });
        if (!mounted) return;
        const count = Array.isArray(rows) ? rows.length : 0;
        setText(count === 0 ? '0' : `${count} activo${count > 1 ? 's' : ''}`);
      } catch {
        if (!mounted) return;
        setText('err');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs">
      {text}
    </span>
  );
}

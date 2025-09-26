import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import creditService, { Credit, CreditsDashboard } from '../services/creditService';
import paymentMethodService from '../services/paymentMethodService';
import { getUserId } from '../utils/auth';

interface CreditClient {
  id: number; // ID del cliente
  creditId: number; // ID del crédito asociado a este cliente
  saleId: number; // Añadido: ID de la venta asociada a este cliente
  name: string;
  creditLimit: string;
  used: string;
  available: string;
  lastPayment: string;
  status: 'active' | 'warning' | 'overdue';
}

const CreditManagement: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('Presarna');
  const [clientId, setClientId] = useState<string>(''); // Para el input 'Civuno'
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // Para el input 'Ratura'
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<Array<{payment_method_id:number; method_name:string}>>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  const creditClients: CreditClient[] = [
    {
      id: 1, 
      creditId: 26, // Actualizado para coincidir con la base de datos del usuario
      saleId: 101, // Añadido: ID de venta de ejemplo
      name: 'Aphe.Emes',
      creditLimit: '$1,000',
      used: '$300',
      available: '$000',
      lastPayment: '20/0164024',
      status: 'active'
    },
    {
      id: 2, 
      creditId: 27, // Actualizado para coincidir con la base de datos del usuario
      saleId: 102, // Añadido: ID de venta de ejemplo
      name: 'Merc-Bzen',
      creditLimit: '$1,000',
      used: '$2,090',
      available: '$000',
      lastPayment: '31102/20/9',
      status: 'warning'
    },
    {
      id: 3, 
      creditId: 28, // Actualizado para coincidir con la base de datos del usuario
      saleId: 103, // Añadido: ID de venta de ejemplo
      name: 'Rick-Pand',
      creditLimit: '$8,000',
      used: '$400',
      available: '$000',
      lastPayment: '1776/2021',
      status: 'overdue'
    },
    {
      id: 4, 
      creditId: 29, // Actualizado para coincidir con la base de datos del usuario
      saleId: 104, // Añadido: ID de venta de ejemplo
      name: 'Aluxu Alioxes',
      creditLimit: '$1,000',
      used: '$480',
      available: '$000',
      lastPayment: '241119/2003',
      status: 'active'
    },
    {
      id: 5, 
      creditId: 30, // Actualizado para coincidir con la base de datos del usuario
      saleId: 105, // Añadido: ID de venta de ejemplo
      name: 'Jom Cojula',
      creditLimit: '$1,000',
      used: '$2,000',
      available: '$000',
      lastPayment: '971802/021',
      status: 'overdue'
    },
    {
      id: 6, 
      creditId: 31, // Actualizado para coincidir con la base de datos del usuario
      saleId: 106, // Añadido: ID de venta de ejemplo
      name: 'Alee Santh',
      creditLimit: '$1,000',
      used: '$150',
      available: '$000',
      lastPayment: '36/027/2027',
      status: 'active'
    }
  ];

  // Cargar métodos de pago al iniciar
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar métodos de pago
        const methods = await paymentMethodService.getAll();
        setPaymentMethods(methods as any);
        if (methods?.length && !selectedPaymentMethodId) {
          setSelectedPaymentMethodId(String(methods[0].payment_method_id));
        }
      } catch (err) {
        setError('Error al cargar los métodos de pago');
      }
    };

    loadData();
  }, [selectedPaymentMethodId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'overdue':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'MMEUA';
      case 'warning':
        return 'MMEUEA';
      case 'overdue':
        return 'MMEUB';
      default:
        return 'UNKNOWN';
    }
  };

  const registerPayment = async () => {
    if (!clientId || !paymentAmount) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }
    if (!selectedPaymentMethodId) {
      alert('Seleccione un método de pago');
      return;
    }
    const userId = getUserId();
    if (!userId) {
      alert('No se pudo determinar el usuario. Inicie sesión nuevamente.');
      return;
    }

    setProcessingPayment(true);
    try {
      // Buscar el crédito del cliente seleccionado
      const clientCredit = creditClients.find(client => 
        client.id.toString() === clientId && 
        (client.status === 'active' || client.status === 'warning' || client.status === 'overdue')
      );

      if (!clientCredit) {
        alert('No se encontró un crédito pendiente para este cliente');
        return;
      }

      // Backend necesita: credit_id (lo pasamos en URL), amount, payment_method_id, user_id, sale_id (opcional), notes (opcional)
      await creditService.addPayment(clientCredit.creditId, {
        amount: parseFloat(paymentAmount),
        payment_method_id: Number(selectedPaymentMethodId),
        user_id: Number(userId),
        sale_id: clientCredit.saleId ?? null,
        notes: paymentReference || undefined,
      });

      alert('Pago registrado exitosamente');
      setClientId('');
      setPaymentAmount('');
      setPaymentReference('');
    } catch (error: any) {
      console.error('Error registering payment:', error);
      alert('Error al registrar el pago: ' + (error.message || 'Error desconocido'));
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Layout currentPage="créditos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Shield size={28} className="mr-3 text-orange-500" />
            Gestión de Créditos
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300">A</span>
            <span className="text-slate-300">Dialo</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Etual dos cregina Snauiernos</h3>
            <p className="text-2xl font-bold text-white">$45,000</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Cnrillits. onalados</h3>
            <p className="text-2xl font-bold text-red-400">$8,500</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Cnritos nanto.cale Spremos</h3>
            <p className="text-2xl font-bold text-yellow-400">$12,000</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="text-sm font-medium text-red-400">Anndo de Cnalito</h3>
            </div>
            <p className="text-xs text-slate-400">Cnriplatea Nucaoas choos craados</p>
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={16} className="text-yellow-500" />
                <span className="text-xs text-yellow-400">Reoplietuono de Page</span>
              </div>
              <p className="text-xs text-slate-400">Aa lullnoa airatc cbtingot preaco</p>
            </div>
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={16} className="text-yellow-500" />
                <span className="text-xs text-yellow-400">Adivaretucor de Eamro</span>
              </div>
              <p className="text-xs text-slate-400">Comalltercelle ccadsaa Dlfda YeNundaa</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-4 mb-4">
            <span className="text-white font-medium">Advanend Fittira</span>
            <div className="flex space-x-2">
              {["Presarna", "Prestlo", "Pregte rarda"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    selectedFilter === filter
                      ? "bg-orange-500 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <button className="ml-auto bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Peentio Cenoara
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Dapotble</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500">
                <option>Seleccionar</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Eectt 1</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500">
                <option>Seleccionar</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Ranne Acnma</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500">
                <option>Rrecine Regitle</option>
              </select>
            </div>
          </div>
        </div>

        {/* Credits Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Chuma</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Meuta de soneto</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Regrie Regido</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Ssalio</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Feran de Recienturos</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-medium">Eclitina</th>
                </tr>
              </thead>
              <tbody>
                {creditClients.map((client, index) => (
                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4 text-white">{client.name}</td>
                    <td className="py-3 px-4 text-white">{client.creditLimit}</td>
                    <td className="py-3 px-4 text-white">{client.used}</td>
                    <td className="py-3 px-4 text-white">{client.available}</td>
                    <td className="py-3 px-4 text-slate-300">{client.lastPayment}</td>
                    <td className="py-3 px-4">
                      <span className={`${getStatusColor(client.status)} text-white px-2 py-1 rounded text-xs font-medium`}>
                        {getStatusText(client.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button className="bg-orange-500 text-white w-8 h-8 rounded flex items-center justify-center">
              1
            </button>
            <button className="bg-slate-700 text-slate-300 w-8 h-8 rounded flex items-center justify-center hover:bg-slate-600">
              →
            </button>
          </div>
          <div className="text-slate-400 text-sm">
            1 ≪ 4
          </div>
        </div>

        {/* Right Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3"></div>
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Registrar Pago Rápido</h3>
              <div className="space-y-3">
                <select
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">Seleccionar Cliente</option>
                  {creditClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - Crédito ID: {client.creditId}
                    </option>
                  ))}
                </select>

                {/* Selector de método de pago */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-300 w-32">Método de pago</label>
                  <select
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm text-white"
                    value={selectedPaymentMethodId}
                    onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  >
                    {paymentMethods.map(pm => (
                      <option key={pm.payment_method_id} value={pm.payment_method_id}>
                        {pm.method_name}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="number"
                  placeholder="Monto a Pagar (ej. 25.00)"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Referencia (opcional)"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />

                <button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded font-medium transition-colors"
                  onClick={registerPayment}
                  disabled={processingPayment}
                >
                  {processingPayment ? 'Procesando...' : 'Registrar Pago'}
                </button>
                {processingPayment && <p className="text-center text-blue-400">Procesando...</p>}
                {error && <p className="text-center text-red-500">Error: {error}</p>}
                {successMessage && <p className="text-center text-green-500">{successMessage}</p>}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Resumen</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total créditos</span>
                  <span className="text-slate-300">4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Créditos pagados</span>
                  <span className="text-slate-300">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Créditos vencidos</span>
                  <span className="text-slate-300">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Clientes con deuda</span>
                  <span className="text-slate-300">2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreditManagement;


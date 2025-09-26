import ApiService from './apiService'; // Asegúrate de que la ruta a tu ApiService sea correcta
import { paymentMethod } from "../../app/grifo-configuracion/types/payment-methods";

/** 👉 Formato simple que usa el modal de pagos */
export type UIPaymentMethod = {
  payment_method_id: number;
  name: string;
  is_active?: boolean;
};

class PaymentMethodService {
  private readonly endpoint = '/payment-methods'; // Endpoint del controlador de métodos de pago en el backend

  /**
   * Obtiene todos los métodos de pago desde el backend.
   * @returns Una promesa que resuelve con un array de métodos de pago.
   */
  async getAll(): Promise<paymentMethod[]> {
    try {
      return await ApiService.get<paymentMethod[]>(this.endpoint);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  }

  async create(data: Partial<paymentMethod>): Promise<paymentMethod> {
    try {
      return await ApiService.post<paymentMethod>(this.endpoint, data);
    } catch (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }
  }

  async update(id: number, data: Partial<paymentMethod>): Promise<paymentMethod> {
    try {
      return await ApiService.patch<paymentMethod>(`${this.endpoint}/${id}`, data);
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await ApiService.delete<void>(`${this.endpoint}/${id}`);
    } catch (error) {
      console.error('Error deleting payment method:', error);
      throw error;
    }
  }

  /* ============================
     🔽 CÓDIGO NUEVO (ADICIONAL)
     — No altera lo existente —
     ============================ */

  /** Normaliza texto: minúsculas, sin espacios ni acentos. */
  private norm(s?: string) {
    return (s ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  /** 🔁 Normalizador a formato simple para el modal */
  private toUI = (m: any): UIPaymentMethod => {
    const id =
      m?.payment_method_id ??
      m?.id ??
      m?.method_id ??
      m?.paymentMethodId;

    const name =
      m?.name ??
      m?.method_name ??
      m?.label ??
      m?.code ??
      (typeof m === 'string' ? m : `Método ${id}`);

    const is_active = m?.is_active ?? m?.enabled ?? m?.active ?? true;

    return {
      payment_method_id: Number(id),
      name: String(name),
      is_active,
    };
  };

  /** Obtiene SOLO los métodos ACTIVOS. Intenta /payment-methods/active y hace fallback a /settings. */
  async getActive(): Promise<paymentMethod[]> {
    try {
      const active = await ApiService.get<paymentMethod[]>(`${this.endpoint}/active`);
      return Array.isArray(active) ? active : [];
    } catch (e) {
      // Fallback a /settings (estructura: { payment_methods: [{ enabled, ... }] })
      try {
        const settings = await ApiService.get<any>('/settings');
        const list = settings?.payment_methods ?? [];
        return list
          .filter((m: any) => !!m?.enabled)
          .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
      } catch (inner) {
        console.error('Error fetching active payment methods (fallback):', inner);
        throw inner;
      }
    }
  }

  /**
   * Devuelve un catálogo "fusionado": primero los activos del backend y,
   * si faltara alguno clásico, lo añade sin duplicar por method_name o id.
   * Útil para que Turnos pinte EXACTAMENTE lo activo en Configuración,
   * pero sin perder compatibilidad si el backend aún no trae alguno.
   */
  async getMergedCatalog(): Promise<paymentMethod[]> {
    // Activos remotos
    const actives = await this.getActive();

    // Catálogo base (opcional, si tu tipo paymentMethod no lo contempla, ignora)
    const base: paymentMethod[] = [
      { id: 1 as any, key: 'CASH' as any, label: 'Efectivo' as any, method_name: 'efectivo' as any, enabled: true } as any,
      { id: 2 as any, key: 'CREDIT' as any, label: 'Credito' as any, method_name: 'credito' as any, enabled: true } as any,
      { id: 3 as any, key: 'CARD' as any, label: 'Tarjeta' as any, method_name: 'tarjeta' as any, enabled: true } as any,
      { id: 4 as any, key: 'TRANSFER' as any, label: 'Transferencia' as any, method_name: 'transferencia' as any, enabled: true } as any,
    ];

    const byName = new Map<string, paymentMethod>();
    const byId = new Map<number | string, paymentMethod>();

    for (const m of actives) {
      const name = this.norm((m as any)?.method_name ?? (m as any)?.code ?? (m as any)?.label);
      if (name) byName.set(name, m);
      const id = (m as any)?.id ?? (m as any)?._id;
      if (id != null) byId.set(id, m);
    }

    for (const b of base) {
      const name = this.norm((b as any)?.method_name ?? (b as any)?.code ?? (b as any)?.label);
      const id = (b as any)?.id ?? (b as any)?._id;
      const hasByName = name && byName.has(name);
      const hasById = id != null && byId.has(id);
      if (!hasByName && !hasById) {
        byName.set(name, b);
      }
    }

    const merged = Array.from(byName.values());
    // Orden por "order" si existe; si no, por label
    merged.sort(
      (a: any, b: any) =>
        (a?.order ?? 999) - (b?.order ?? 999) ||
        String(a?.label ?? '').localeCompare(String(b?.label ?? ''))
    );
    return merged;
  }

  /**
   * Mapa rápido { method_name(normalizado) -> paymentMethod } a partir de activos.
   * Útil para resolver etiquetas y desglose en Turnos.
   */
  async getActiveMapByName(): Promise<Record<string, paymentMethod>> {
    const list = await this.getActive();
    const map: Record<string, paymentMethod> = {};
    for (const m of list) {
      const name = this.norm((m as any)?.method_name ?? (m as any)?.code ?? (m as any)?.label);
      if (name) map[name] = m;
    }
    return map;
  }

  /**
   * Atajo si necesitas actualizar con id numérico sin cambiar tu `update(id: string, ...)`.
   * (No sustituye a tu update; solo facilita llamar con number.)
   */
  async updateById(id: number, data: Partial<paymentMethod>): Promise<paymentMethod> {
    return this.update(id, data);
  }

  /** Obtiene un label a partir de un objeto de venta o de un código/method_name (dinámico). */
  async getLabelDynamic(saleOrCode: any): Promise<string> {
    const catalog = await this.getMergedCatalog();
    // Si te pasan string directo
    if (typeof saleOrCode === 'string') {
      const key = this.norm(saleOrCode);
      const hit = catalog.find((m: any) => {
        const name = this.norm(m?.method_name ?? m?.code ?? m?.label);
        const kKey = this.norm(m?.key);
        return name === key || (kKey && kKey === key);
      });
      return (hit as any)?.label ?? saleOrCode;
    }

    // Si te pasan una venta
    const tryFields = [
      saleOrCode?.payment_method,
      saleOrCode?.paymentMethod,
      saleOrCode?.method,
      saleOrCode?.payment?.method,
      saleOrCode?.payment_mode,
      saleOrCode?.pay_mode,
    ].map(this.norm);

    for (const f of tryFields) {
      if (!f) continue;
      const hit = catalog.find((m: any) => this.norm(m?.method_name ?? m?.code ?? m?.label) === f);
      if (hit) return (hit as any)?.label ?? '—';
    }

    // flags de crédito
    if (
      saleOrCode?.is_credit === true ||
      saleOrCode?.credit === true ||
      saleOrCode?.credit_id || saleOrCode?.creditId ||
      saleOrCode?.payment_type === 'credit'
    ) {
      const credit = catalog.find((m: any) =>
        this.norm(m?.method_name) === 'credito' || this.norm(m?.key) === 'credit'
      );
      return (credit as any)?.label ?? 'Credito';
    }

    // notes JSON
    const notes = saleOrCode?.notes;
    if (typeof notes === 'string' && notes.trim().startsWith('{')) {
      try {
        const n = JSON.parse(notes);
        const cand = [n?.payment_method, n?.method, n?.pm, n?.type].map(this.norm);
        for (const f of cand) {
          if (!f) continue;
          const hit = catalog.find((m: any) => this.norm(m?.method_name ?? m?.code ?? m?.label) === f);
          if (hit) return (hit as any)?.label ?? '—';
        }
        if (n?.credit === true) {
          const credit = catalog.find((m: any) =>
            this.norm(m?.method_name) === 'credito' || this.norm(m?.key) === 'credit'
          );
          return (credit as any)?.label ?? 'Credito';
        }
      } catch {}
    }

    // por id
    const id = Number(saleOrCode?.payment_method_id);
    if (Number.isFinite(id)) {
      const byId = catalog.find((m: any) => (m?.id ?? m?._id) == id);
      return (byId as any)?.label ?? '—';
    }

    return '—';
  }

  /** 👉 NUEVO: lista ya normalizada para el modal */
  async getUIList(): Promise<UIPaymentMethod[]> {
    try {
      const active = await this.getActive();           // primero intentamos activos
      if (Array.isArray(active) && active.length) {
        return active.map(this.toUI);
      }
    } catch {}
    // fallback a todos
    const all = await this.getAll();
    return (all ?? []).map(this.toUI);
  }
}

const paymentMethodService = new PaymentMethodService();
export default paymentMethodService;

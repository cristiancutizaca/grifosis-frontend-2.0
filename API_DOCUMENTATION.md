# API Documentation - Sistema de Gestión de Grifo

## Descripción General

Esta documentación describe las APIs REST del sistema de gestión de grifo. Todas las APIs siguen el patrón RESTful y devuelven respuestas en formato JSON.

**Base URL:** `http://localhost:3001/api`

## Autenticación

Todas las APIs requieren autenticación mediante JWT token en el header:
```
Authorization: Bearer <token>
```

## Endpoints Principales

### 1. Clientes (`/api/clientes`)

#### GET `/api/clientes`
Obtiene la lista de todos los clientes.

**Parámetros de consulta:**
- `tipo_cliente` (opcional): 'persona' | 'empresa'
- `con_credito` (opcional): boolean
- `estado` (opcional): 'activo' | 'inactivo' | 'suspendido'

**Respuesta:**
```json
[
  {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "documento": "12345678",
    "tipo_documento": "DNI",
    "telefono": "+51987654321",
    "email": "juan@email.com",
    "direccion": "Av. Principal 123",
    "tipo_cliente": "persona",
    "limite_credito": 1000.00,
    "credito_disponible": 800.00,
    "estado": "activo",
    "fecha_registro": "2024-01-15T10:30:00Z",
    "fecha_actualizacion": "2024-01-15T10:30:00Z"
  }
]
```

#### POST `/api/clientes`
Crea un nuevo cliente.

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "documento": "12345678",
  "tipo_documento": "DNI",
  "telefono": "+51987654321",
  "email": "juan@email.com",
  "direccion": "Av. Principal 123",
  "tipo_cliente": "persona",
  "limite_credito": 1000.00
}
```

#### GET `/api/clientes/{id}`
Obtiene un cliente específico por ID.

#### PUT `/api/clientes/{id}`
Actualiza un cliente existente.

#### DELETE `/api/clientes/{id}`
Elimina un cliente.

#### GET `/api/clientes/search?q={query}`
Busca clientes por nombre, documento o email.

### 2. Ventas (`/api/ventas`)

#### GET `/api/ventas`
Obtiene la lista de ventas.

**Parámetros de consulta:**
- `fecha_inicio`: YYYY-MM-DD
- `fecha_fin`: YYYY-MM-DD
- `cliente_id`: number
- `empleado_id`: number
- `bomba_id`: number
- `producto_id`: number
- `metodo_pago`: 'efectivo' | 'tarjeta' | 'credito' | 'transferencia'
- `estado`: 'completada' | 'pendiente' | 'cancelada'

**Respuesta:**
```json
[
  {
    "id": 1,
    "cliente_id": 1,
    "empleado_id": 1,
    "bomba_id": 1,
    "producto_id": 1,
    "cantidad": 20.5,
    "precio_unitario": 4.50,
    "subtotal": 92.25,
    "descuento": 0.00,
    "total": 92.25,
    "metodo_pago": "efectivo",
    "estado": "completada",
    "fecha_venta": "2024-01-15T14:30:00Z",
    "observaciones": null
  }
]
```

#### POST `/api/ventas`
Registra una nueva venta.

**Body:**
```json
{
  "cliente_id": 1,
  "empleado_id": 1,
  "bomba_id": 1,
  "producto_id": 1,
  "cantidad": 20.5,
  "precio_unitario": 4.50,
  "descuento": 0.00,
  "metodo_pago": "efectivo",
  "observaciones": "Venta regular"
}
```

#### GET `/api/ventas/diarias?fecha={YYYY-MM-DD}`
Obtiene las ventas del día especificado.

#### GET `/api/ventas/estadisticas`
Obtiene estadísticas de ventas.

### 3. Créditos (`/api/creditos`)

#### GET `/api/creditos`
Obtiene la lista de créditos.

**Respuesta:**
```json
[
  {
    "id": 1,
    "cliente_id": 1,
    "limite_credito": 1000.00,
    "credito_usado": 200.00,
    "credito_disponible": 800.00,
    "estado": "activo",
    "fecha_vencimiento": "2024-12-31",
    "fecha_creacion": "2024-01-15T10:30:00Z",
    "fecha_actualizacion": "2024-01-15T10:30:00Z"
  }
]
```

#### POST `/api/creditos`
Crea un nuevo crédito.

#### GET `/api/creditos/cliente/{cliente_id}`
Obtiene el crédito de un cliente específico.

#### POST `/api/creditos/pagos`
Registra un pago de crédito.

**Body:**
```json
{
  "credito_id": 1,
  "monto": 100.00,
  "metodo_pago": "efectivo",
  "referencia": "PAG001",
  "observaciones": "Pago parcial"
}
```

#### GET `/api/creditos/alertas`
Obtiene alertas de crédito.

### 4. Inventario (`/api/inventario`)

#### GET `/api/inventario/productos`
Obtiene la lista de productos.

**Respuesta:**
```json
[
  {
    "id": 1,
    "nombre": "Gasolina 95",
    "tipo": "combustible",
    "precio_compra": 3.80,
    "precio_venta": 4.50,
    "unidad_medida": "galones",
    "stock_actual": 1500.0,
    "stock_minimo": 200.0,
    "stock_maximo": 2000.0,
    "estado": "activo",
    "fecha_creacion": "2024-01-15T10:30:00Z",
    "fecha_actualizacion": "2024-01-15T10:30:00Z"
  }
]
```

#### POST `/api/inventario/productos`
Crea un nuevo producto.

#### GET `/api/inventario/movimientos`
Obtiene movimientos de inventario.

#### POST `/api/inventario/movimientos`
Registra un movimiento de inventario.

#### GET `/api/inventario/tanques`
Obtiene el estado de los tanques.

#### PUT `/api/inventario/tanques/{id}/nivel`
Actualiza el nivel de un tanque.

### 5. Dashboard (`/api/dashboard`)

#### GET `/api/dashboard/estadisticas`
Obtiene estadísticas generales del dashboard.

**Respuesta:**
```json
{
  "ventas_hoy": {
    "total_ventas": 45,
    "total_ingresos": 2150.75,
    "total_litros": 850.5
  },
  "ventas_mes": {
    "total_ventas": 1250,
    "total_ingresos": 58750.25,
    "total_litros": 25500.0
  },
  "clientes": {
    "total_clientes": 150,
    "clientes_activos": 120,
    "nuevos_clientes_mes": 8
  },
  "inventario": {
    "productos_stock_bajo": 3,
    "tanques_nivel_bajo": 1,
    "valor_inventario": 125000.00
  },
  "creditos": {
    "creditos_activos": 25,
    "credito_total_otorgado": 50000.00,
    "credito_total_usado": 15000.00,
    "pagos_vencidos": 2
  },
  "bombas": {
    "bombas_activas": 6,
    "bombas_mantenimiento": 1,
    "bombas_fuera_servicio": 0
  }
}
```

#### GET `/api/dashboard/ventas-chart?periodo={dia|semana|mes}`
Obtiene datos para gráficos de ventas.

#### GET `/api/dashboard/productos-top?limit={number}`
Obtiene los productos más vendidos.

#### GET `/api/dashboard/actividad-reciente?limit={number}`
Obtiene actividad reciente del sistema.

## Códigos de Estado HTTP

- `200 OK`: Operación exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Datos de entrada inválidos
- `401 Unauthorized`: Token de autenticación inválido o faltante
- `403 Forbidden`: Sin permisos para acceder al recurso
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error interno del servidor

## Formato de Errores

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos proporcionados no son válidos",
    "details": [
      {
        "field": "email",
        "message": "El email no tiene un formato válido"
      }
    ]
  }
}
```

## Paginación

Para endpoints que devuelven listas, se puede usar paginación:

**Parámetros:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10, max: 100)

**Respuesta:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

## Filtros y Ordenamiento

**Filtros:**
- Usar parámetros de consulta específicos para cada endpoint

**Ordenamiento:**
- `sort`: Campo por el cual ordenar
- `order`: 'asc' | 'desc' (default: 'asc')

Ejemplo: `/api/clientes?sort=nombre&order=desc`

## Webhooks (Opcional)

El sistema puede enviar webhooks para eventos importantes:

- `venta.completada`: Cuando se completa una venta
- `credito.vencido`: Cuando un crédito vence
- `inventario.stock_bajo`: Cuando un producto tiene stock bajo
- `bomba.mantenimiento`: Cuando una bomba requiere mantenimiento

## Rate Limiting

- 1000 requests por hora por IP
- 100 requests por minuto por usuario autenticado

## Versionado

La API actual es v1. Las versiones futuras se especificarán en la URL:
- `/api/v1/clientes`
- `/api/v2/clientes`


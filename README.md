<<<<<<< HEAD
# Sistema de Gestión de Grifo - Frontend

Un sistema completo de gestión para estaciones de servicio desarrollado con React, TypeScript y Tailwind CSS.

## 🚀 Características

- **Dashboard Interactivo**: Vista general con estadísticas en tiempo real
- **Gestión de Clientes**: CRUD completo con sistema de créditos
- **Sistema de Ventas**: Registro de ventas con múltiples métodos de pago
- **Control de Inventario**: Gestión de productos, tanques y movimientos
- **Gestión de Créditos**: Control de límites, pagos y alertas
- **Reportes**: Estadísticas y reportes detallados
- **Interfaz Responsive**: Diseño adaptable para desktop y móviles
- **TypeScript**: Tipado estático para mayor robustez
- **Tailwind CSS**: Diseño moderno y consistente

## 🛠️ Tecnologías

- **React 18** - Biblioteca de interfaz de usuario
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework de CSS utilitario
- **Lucide React** - Iconos modernos
- **React Router** - Navegación SPA
- **Vite** - Herramienta de construcción rápida

## 📋 Prerrequisitos

- Node.js 16.0 o superior
- npm o yarn
- Backend API ejecutándose (ver documentación de API)

## 🔧 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd frontend-grifosis-main
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` con la configuración apropiada:
   ```env
   REACT_APP_API_URL=http://localhost:3001/api
   REACT_APP_APP_NAME=Sistema de Gestión de Grifo
   REACT_APP_VERSION=1.0.0
   ```

4. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:5173
   ```

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── Layout.tsx      # Layout principal con sidebar
│   ├── StatCard.tsx    # Tarjetas de estadísticas
│   ├── FuelButton.tsx  # Botones de combustible
│   └── ...
├── pages/              # Páginas principales
│   ├── Dashboard.tsx   # Dashboard principal
│   ├── Clients.tsx     # Gestión de clientes
│   ├── NewSale.tsx     # Nueva venta
│   └── ...
├── services/           # Servicios de API
│   ├── apiService.ts   # Servicio base de API
│   ├── clientService.ts # Servicio de clientes
│   ├── saleService.ts  # Servicio de ventas
│   └── ...
├── hooks/              # Hooks personalizados
│   └── useApi.ts       # Hook para llamadas API
├── types/              # Definiciones de tipos TypeScript
└── App.tsx             # Componente principal
```

## 🎯 Funcionalidades Principales

### Dashboard
- Estadísticas de ventas diarias y mensuales
- Estado de inventario y tanques
- Alertas y notificaciones
- Gráficos de rendimiento

### Gestión de Clientes
- Registro de clientes (personas y empresas)
- Búsqueda y filtrado avanzado
- Gestión de límites de crédito
- Historial de transacciones

### Sistema de Ventas
- Registro de ventas por bomba
- Selección de combustible
- Múltiples métodos de pago
- Cálculo automático de totales
- Gestión de descuentos

### Control de Inventario
- Gestión de productos
- Control de stock mínimo/máximo
- Movimientos de inventario
- Estado de tanques en tiempo real

### Gestión de Créditos
- Límites de crédito por cliente
- Registro de pagos
- Alertas de vencimiento
- Reportes de morosidad

## 🔌 Integración con API

El frontend se conecta con el backend a través de servicios TypeScript que encapsulan las llamadas a la API REST. Cada servicio maneja:

- Autenticación automática
- Manejo de errores
- Tipado de respuestas
- Transformación de datos

### Ejemplo de uso:

```typescript
import clientService from './services/clientService';

// Obtener todos los clientes
const clients = await clientService.getAllClients();

// Crear un nuevo cliente
const newClient = await clientService.createClient({
  nombre: 'Juan',
  apellido: 'Pérez',
  documento: '12345678',
  tipo_documento: 'DNI',
  tipo_cliente: 'persona'
});
```

## 🎨 Personalización

### Colores
El sistema utiliza una paleta de colores personalizada definida en Tailwind CSS:

- **Primario**: Naranja (#f97316)
- **Fondo**: Slate oscuro (#0f172a, #1e293b)
- **Texto**: Blanco y grises
- **Estados**: Verde (éxito), Rojo (error), Amarillo (advertencia)

### Componentes
Todos los componentes están diseñados para ser reutilizables y personalizables a través de props.

## 📱 Responsive Design

El sistema está optimizado para:
- **Desktop**: Experiencia completa con sidebar expandido
- **Tablet**: Layout adaptado con sidebar colapsable
- **Mobile**: Interfaz táctil optimizada

## 🔒 Seguridad

- Autenticación JWT
- Validación de datos en frontend y backend
- Sanitización de inputs
- Protección contra XSS
- Headers de seguridad

## 🧪 Testing

```bash
# Ejecutar tests
npm run test

# Tests con cobertura
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

## 🚀 Construcción para Producción

```bash
# Construir para producción
npm run build

# Previsualizar build
npm run preview
```

Los archivos se generarán en la carpeta `dist/`.

## 📊 Monitoreo y Analytics

El sistema incluye:
- Logging de errores
- Métricas de rendimiento
- Analytics de uso (opcional)
- Monitoreo de API calls

## 🔧 Configuración Avanzada

### Variables de Entorno

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_API_TIMEOUT=30000

# App Configuration
REACT_APP_APP_NAME=Sistema de Gestión de Grifo
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=development

# Features
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_LOGGING=true

# UI Configuration
REACT_APP_ITEMS_PER_PAGE=10
REACT_APP_AUTO_REFRESH_INTERVAL=30000
```

### Configuración de Tailwind

El archivo `tailwind.config.js` incluye configuraciones personalizadas para:
- Colores del tema
- Espaciado personalizado
- Animaciones
- Breakpoints responsive

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para la feature (`git checkout -b feature/AmazingFeature`)
3. Commit los cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📝 Convenciones de Código

- **TypeScript**: Tipado estricto obligatorio
- **Naming**: camelCase para variables, PascalCase para componentes
- **Imports**: Imports absolutos usando alias `@/`
- **Componentes**: Un componente por archivo
- **Hooks**: Prefijo `use` para hooks personalizados

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Error de conexión con API**
   - Verificar que el backend esté ejecutándose
   - Revisar la URL en `.env`
   - Verificar CORS en el backend

2. **Errores de TypeScript**
   - Ejecutar `npm run type-check`
   - Verificar tipos en `src/types/`

3. **Problemas de estilos**
   - Verificar que Tailwind esté configurado correctamente
   - Revisar `tailwind.config.js`

### Logs y Debugging

```bash
# Ver logs detallados
npm run dev -- --debug

# Analizar bundle
npm run analyze
```

## 📞 Soporte

Para soporte técnico:
- Crear un issue en GitHub
- Revisar la documentación de API
- Consultar los logs del navegador

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🔄 Changelog

### v1.0.0 (2024-01-15)
- Lanzamiento inicial
- Dashboard completo
- Gestión de clientes y ventas
- Sistema de créditos
- Control de inventario
- Interfaz responsive

---

**Desarrollado con ❤️ para la gestión eficiente de estaciones de servicio**

=======
<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
>>>>>>> 2e7718a9799e17ac4a6b59076514a5d38f485fd5
"# grifosis-frontend-2.0" 

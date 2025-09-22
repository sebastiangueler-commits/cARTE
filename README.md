# Portfolio Manager Pro 🚀

Un sistema profesional de gestión de carteras de inversión con análisis en tiempo real, OCR para extracción de activos desde imágenes, y una interfaz moderna y responsiva.

## ✨ Características Principales

- **📊 Dashboard Completo**: Vista general con estadísticas en tiempo real
- **💼 Gestión de Carteras**: Crear, editar y eliminar carteras de inversión
- **📈 Precios en Tiempo Real**: Integración con Yahoo Finance API
- **🔍 OCR Inteligente**: Extracción automática de activos desde imágenes
- **📱 Diseño Responsivo**: Funciona perfectamente en móviles y escritorio
- **🎨 UI/UX Moderna**: Interfaz profesional con animaciones suaves
- **💾 Base de Datos SQLite**: Almacenamiento local eficiente
- **🔄 Actualización Automática**: Precios actualizados cada 5 minutos

## 🛠️ Tecnologías Utilizadas

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **SQLite3** - Base de datos local
- **Multer** - Manejo de archivos
- **CORS** - Configuración de acceso cruzado

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Estilos modernos con variables CSS
- **JavaScript ES6+** - Lógica de la aplicación
- **Font Awesome** - Iconografía profesional
- **Fetch API** - Comunicación con el backend

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 16+ instalado
- NPM o Yarn

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd portfolio-manager-pro
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   npm start
   ```

4. **Acceder a la aplicación**
   - Abrir navegador en: `http://localhost:5000`
   - El servidor se ejecuta en el puerto 5000

## 📋 Funcionalidades Detalladas

### Dashboard
- **Estadísticas Generales**: Valor total, ganancias/pérdidas, número de carteras y activos
- **Resumen de Carteras**: Vista rápida de todas las carteras con métricas clave
- **Actualización Automática**: Datos refrescados cada 30 segundos

### Gestión de Carteras
- **Crear Cartera**: Desde imagen OCR o entrada manual
- **Editar Cartera**: Modificar nombre y descripción
- **Eliminar Cartera**: Borrado completo con confirmación
- **Vista Detallada**: Análisis completo de cada cartera

### OCR Inteligente
- **Subida de Imágenes**: Soporte para PNG, JPG, JPEG
- **Extracción Automática**: Detección de símbolos y cantidades
- **Entrada Manual**: Fallback para activos específicos
- **Validación**: Verificación de símbolos válidos

### Análisis de Activos
- **Precios Actuales**: Obtenidos de Yahoo Finance
- **Cálculo de Ganancias**: Comparación con precio de compra
- **Métricas de Rendimiento**: Porcentajes de ganancia/pérdida
- **Historial de Precios**: Seguimiento temporal

## 🔧 API Endpoints

### Carteras
- `GET /api/portfolios` - Obtener todas las carteras
- `GET /api/portfolios/:id` - Obtener cartera específica
- `POST /api/portfolios` - Crear nueva cartera
- `POST /api/portfolios/ocr` - Crear cartera desde imagen
- `PUT /api/portfolios/:id` - Actualizar cartera
- `DELETE /api/portfolios/:id` - Eliminar cartera

### Activos
- `GET /api/assets` - Obtener todos los activos
- `POST /api/assets` - Agregar activo
- `PUT /api/assets/:id` - Actualizar activo
- `DELETE /api/assets/:id` - Eliminar activo

### Precios
- `GET /api/prices/:symbol` - Obtener precio de símbolo
- `POST /api/prices/update` - Actualizar todos los precios

### Estadísticas
- `GET /api/stats` - Obtener estadísticas generales

## 📱 Diseño Responsivo

El diseño se adapta perfectamente a diferentes tamaños de pantalla:

- **Desktop**: Sidebar fijo con navegación completa
- **Tablet**: Layout optimizado para pantallas medianas
- **Mobile**: Navegación colapsable y cards apiladas

## 🎨 Características de UI/UX

- **Gradientes Modernos**: Fondos atractivos y profesionales
- **Animaciones Suaves**: Transiciones fluidas entre estados
- **Iconografía Consistente**: Font Awesome para todos los iconos
- **Feedback Visual**: Alertas y mensajes informativos
- **Loading States**: Indicadores de carga durante operaciones
- **Hover Effects**: Interacciones visuales en elementos

## 🔒 Seguridad

- **Validación de Archivos**: Solo imágenes permitidas
- **Sanitización de Datos**: Limpieza de entradas del usuario
- **Límites de Tamaño**: Archivos máximo 10MB
- **CORS Configurado**: Acceso controlado desde frontend

## 📊 Base de Datos

### Esquema SQLite
- **portfolios**: Información de carteras
- **assets**: Activos individuales
- **transactions**: Historial de transacciones
- **price_history**: Seguimiento de precios

### Características
- **Relaciones**: Claves foráneas entre tablas
- **Índices**: Optimización de consultas
- **Timestamps**: Fechas de creación y actualización
- **Cascading**: Eliminación en cascada

## 🚀 Despliegue

### Desarrollo Local
```bash
npm start
```

### Producción
   ```bash
NODE_ENV=production npm start
```

### Variables de Entorno
- `PORT`: Puerto del servidor (default: 5000)
- `NODE_ENV`: Entorno de ejecución

## 🔄 Mantenimiento

### Actualización de Precios
- **Automática**: Cada 5 minutos
- **Manual**: Botón de actualización en UI
- **API**: Endpoint dedicado para actualización

### Limpieza de Datos
- **Archivos**: Limpieza automática de uploads temporales
- **Base de Datos**: Mantenimiento automático de índices

## 🐛 Solución de Problemas

### Servidor no inicia
- Verificar que el puerto 5000 esté libre
- Comprobar instalación de Node.js
- Revisar dependencias: `npm install`

### Precios no se actualizan
- Verificar conexión a internet
- Comprobar acceso a Yahoo Finance
- Revisar logs del servidor

### OCR no funciona
- Verificar formato de imagen (PNG, JPG)
- Comprobar tamaño del archivo (< 10MB)
- Usar entrada manual como alternativa

## 📈 Roadmap Futuro

- [ ] **Autenticación de Usuarios**: Sistema de login/registro
- [ ] **Múltiples Carteras por Usuario**: Gestión de usuarios
- [ ] **Gráficos Avanzados**: Chart.js para visualizaciones
- [ ] **Exportación de Datos**: PDF y Excel
- [ ] **Notificaciones**: Alertas de precios
- [ ] **API Externa**: Integración con más fuentes de datos
- [ ] **Modo Oscuro**: Tema alternativo
- [ ] **PWA**: Aplicación web progresiva

## 📄 Licencia

MIT License - Ver archivo LICENSE para detalles

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico o preguntas:
- Crear un issue en el repositorio
- Revisar la documentación
- Verificar logs del servidor

---

**Portfolio Manager Pro** - Gestión profesional de carteras de inversión 🚀
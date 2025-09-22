# Portfolio Manager Pro - Deploy Script

## Build para Netlify

Este script prepara la aplicación para deploy en Netlify.

### Archivos necesarios:
- `index.html` (frontend)
- `server.js` (backend - se convertirá a Netlify Functions)
- `package.json` (dependencias)
- `netlify.toml` (configuración)

### Pasos:
1. Instalar dependencias: `npm install`
2. Crear función Netlify para el backend
3. Configurar variables de entorno
4. Deploy automático

### Variables de entorno requeridas:
- `JWT_SECRET`: Clave secreta para JWT
- `NODE_ENV`: production

### Comandos:
```bash
npm install
npm run build
netlify deploy --prod
```

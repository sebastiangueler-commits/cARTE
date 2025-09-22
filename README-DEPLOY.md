# 🚀 Portfolio Manager Pro - Deploy a Netlify

## 📋 Instrucciones Paso a Paso

### **1. Preparar el Repositorio**

1. **Inicializar Git** (si no está inicializado):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Portfolio Manager Pro"
   ```

2. **Crear repositorio en GitHub**:
   - Ve a [GitHub](https://github.com)
   - Crea un nuevo repositorio público
   - Conecta tu proyecto local:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

### **2. Deploy en Netlify**

1. **Ir a Netlify**:
   - Ve a [netlify.com](https://netlify.com)
   - Inicia sesión o crea una cuenta

2. **Conectar con GitHub**:
   - Haz clic en "New site from Git"
   - Selecciona "GitHub"
   - Autoriza Netlify a acceder a tus repositorios
   - Selecciona tu repositorio del Portfolio Manager

3. **Configurar el Deploy**:
   - **Build command**: `npm install`
   - **Publish directory**: `.` (punto)
   - **Node version**: `18`

4. **Variables de Entorno**:
   - Ve a "Site settings" > "Environment variables"
   - Agrega:
     - `JWT_SECRET`: `portfolio-manager-secret-key-2024-production`
     - `NODE_ENV`: `production`

5. **Deploy**:
   - Haz clic en "Deploy site"
   - Espera a que termine el build (2-3 minutos)

### **3. Configuración Adicional**

1. **Dominio Personalizado** (opcional):
   - Ve a "Domain settings"
   - Agrega tu dominio personalizado

2. **HTTPS**:
   - Netlify proporciona HTTPS automáticamente
   - Certificado SSL gratuito incluido

### **4. Verificar el Deploy**

1. **Probar la aplicación**:
   - Ve a tu URL de Netlify (ej: `https://tu-app.netlify.app`)
   - Inicia sesión con `admin` / `admin123`
   - Prueba crear carteras y gestionar usuarios

2. **Funcionalidades disponibles**:
   - ✅ Autenticación de usuarios
   - ✅ Dashboard de administración
   - ✅ Gestión de usuarios (solo admin)
   - ✅ Creación de carteras
   - ✅ Simulación de OCR (activos de demo)
   - ✅ Precios en tiempo real de Yahoo Finance

### **5. Monitoreo**

1. **Logs**:
   - Ve a "Functions" en el dashboard de Netlify
   - Revisa los logs de las funciones

2. **Analytics**:
   - Netlify Analytics está disponible en el plan gratuito
   - Ve a "Analytics" en el dashboard

## 🔧 Estructura del Proyecto

```
├── index.html              # Frontend principal
├── package.json            # Dependencias
├── netlify.toml           # Configuración de Netlify
├── netlify/
│   └── functions/
│       └── api/
│           └── index.js   # Función principal de la API
├── uploads/               # Directorio de uploads (no se usa en Netlify)
└── README.md             # Este archivo
```

## 🚨 Notas Importantes

1. **Base de Datos**: Se usa SQLite en memoria (se reinicia en cada función)
2. **OCR**: Simulado con activos de demostración
3. **Uploads**: No disponible en Netlify Functions (limitación de la plataforma)
4. **Persistencia**: Los datos se pierden al reiniciar la función

## 🆘 Solución de Problemas

1. **Error de Build**:
   - Revisa los logs en Netlify
   - Verifica que todas las dependencias estén en `package.json`

2. **Error 500**:
   - Revisa los logs de Functions
   - Verifica las variables de entorno

3. **CORS Error**:
   - Netlify maneja CORS automáticamente
   - Si persiste, revisa la configuración de `netlify.toml`

## 📞 Soporte

Si tienes problemas con el deploy, revisa:
- [Documentación de Netlify](https://docs.netlify.com/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Logs de Netlify](https://docs.netlify.com/monitor-sites/)

---

**¡Tu Portfolio Manager Pro estará disponible en línea en minutos!** 🎉

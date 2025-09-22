# 🌍 DESPLIEGUE GLOBAL - ACCESO MUNDIAL

## 🚀 Desplegar en Netlify (GRATUITO)

### Paso 1: Preparar el proyecto
1. Asegúrate de que todos los archivos estén en la carpeta del proyecto
2. Verifica que `netlify.toml` esté configurado correctamente
3. Confirma que `netlify/functions/api/index.js` esté actualizado

### Paso 2: Crear cuenta en Netlify
1. Ve a [netlify.com](https://netlify.com)
2. Regístrate con GitHub, GitLab o email
3. Haz clic en "New site from Git"

### Paso 3: Conectar repositorio
1. **Opción A - Con GitHub/GitLab:**
   - Conecta tu repositorio
   - Selecciona la rama principal
   - Netlify detectará automáticamente la configuración

2. **Opción B - Deploy manual:**
   - Arrastra y suelta la carpeta del proyecto en Netlify
   - O usa el CLI: `netlify deploy --prod --dir .`

### Paso 4: Configurar variables de entorno
En el dashboard de Netlify:
1. Ve a Site settings > Environment variables
2. Agrega estas variables:
   ```
   JWT_SECRET = portfolio-manager-secret-key-2024-production
   NODE_ENV = production
   CLIENT_URL = https://admincarteras.netlify.app
   ```

### Paso 5: Actualizar URL en el código
1. En `netlify.toml`, cambia:
   ```toml
   CLIENT_URL = "https://admincarteras.netlify.app"
   ```
2. En `netlify/functions/api/index.js`, cambia:
   ```javascript
   'https://admincarteras.netlify.app', // URL real de tu aplicación
   ```

### Paso 6: Deploy
1. Netlify construirá automáticamente tu sitio
2. Tu app estará disponible en: `https://admincarteras.netlify.app`
3. **¡Ya es accesible desde cualquier dispositivo en el mundo!**

---

## 🌐 URLs de Acceso Mundial

Una vez desplegado, tu aplicación será accesible desde:

- **🌍 Cualquier país:** `https://admincarteras.netlify.app`
- **📱 Celulares:** Funciona en cualquier dispositivo móvil
- **💻 Computadoras:** Acceso desde cualquier PC/Mac
- **🌐 Navegadores:** Chrome, Firefox, Safari, Edge, etc.

---

## 🔧 Configuración Adicional

### Dominio Personalizado (Opcional)
1. En Netlify: Site settings > Domain management
2. Agrega tu dominio personalizado
3. Configura DNS según las instrucciones

### SSL/HTTPS
- ✅ **Automático:** Netlify proporciona SSL gratis
- ✅ **Siempre activo:** HTTPS habilitado por defecto

---

## 📱 Credenciales de Acceso

**Usuario administrador:**
- Usuario: `admin`
- Contraseña: `admin123`

**Funciones disponibles:**
- ✅ Crear y gestionar carteras
- ✅ Subir imágenes OCR
- ✅ Ver precios en tiempo real
- ✅ Gestión de usuarios (solo admin)
- ✅ Reportes y estadísticas

---

## 🚨 Solución de Problemas

### Error de CORS
- ✅ **Solucionado:** CORS configurado para acceso mundial
- ✅ **Producción:** Permite cualquier origen

### Error de conexión
- ✅ **Verifica:** Que la URL sea correcta
- ✅ **Prueba:** Desde diferentes dispositivos
- ✅ **Revisa:** Variables de entorno en Netlify

### Base de datos
- ✅ **SQLite en memoria:** Funciona en Netlify Functions
- ✅ **Datos persistentes:** Se mantienen durante la sesión
- ✅ **Reinicio:** Los datos se reinician con cada deploy

---

## 🎯 Próximos Pasos

1. **Deploy inmediato:** Sigue los pasos de arriba
2. **Prueba global:** Accede desde diferentes dispositivos
3. **Comparte:** Envía la URL a quien quieras
4. **Personaliza:** Cambia colores, logos, etc.

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Netlify Dashboard
2. Verifica las variables de entorno
3. Confirma que todos los archivos estén subidos
4. Prueba desde diferentes navegadores

**¡Tu aplicación estará disponible mundialmente en minutos!** 🌍✨

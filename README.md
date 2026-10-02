# ShortLink Pro - App Acortador de Enlaces y Analítica 🚀

Aplicación completa de acortador de URLs, panel de administración y monitoreo en tiempo real, autenticación por Gmail, métricas detalladas y cliente Android listo para compilar. Diseñada para alojar su código `index.html` en **GitHub Pages**.

---

## 🌟 Características Principales

### 🔐 1. Autenticación y Sistema de Permisos
* **Autenticación Gmail (Google Sign-In):** Inicio de sesión rápido para administradores y editores.
* **Enlace de Invitación y Permisos:** Comparte un enlace directo de invitación asignando roles:
  * **Admin / Editor:** Acceso completo para crear, editar, configurar y eliminar enlaces.
  * **Solo Lector (Viewer):** Permite visualizar el panel y analizar métricas sin alterar la configuración.

---

### ✂️ 2. Módulo Acortar Enlaces (Parámetros Técnicos)
* **Enlace largo:** URL de destino original a reducir.
* **Límite Mensual Dinámico:** Contador visible `"Puedes crear 250 enlaces más este mes"` con reinicio automático de cuota.
* **Título Interno:** Nombre de referencia para identificar el enlace en el panel.
* **Dominio:** Selección de dominio base (`goo.su` predeterminado o dominios personalizados).
* **Alias (Slug):** Sufijo personalizado después de la barra diagonal (ej. `/oferta-verano`).
* **Píxeles de Seguimiento:** Integración de retargeting externa (Facebook Pixel ID, Google Ads / GA4).
* **Intimidad / Privacidad:** Nivel de visibilidad (`Público e indexable` vs. `Privado`).
* **Grupo / Carpeta:** Categorización interna para campañas masivas o individuales.
* **Etiquetas (Tags):** Palabras clave asociadas para búsqueda rápida.
* **Contraseña de Acceso:** Protección con clave requerida antes de redirigir al destino.
* **Fecha de Desactivación:** Límite de expiración programado tras el cual el enlace queda inactivo.

---

### 📊 3. Panel Central de Administración y Monitoreo

#### Área 1: Filtros y Búsqueda de Enlaces
* **Buscar por Alias / Título:** Búsqueda en tiempo real por sufijo o nombre.
* **Ingrese Etiquetas:** Filtrado dinámico por tags (ej. `#facebook`, `#oferta`).
* **Rango de Fechas:** Filtro por fecha de creación (Desde / Hasta).
* **Ordenamiento:** Clasificación ascendente/descendente por **Fecha de creación** o **Volumen de Clics**.

#### Área 2: Métricas y Datos del Listado
* **Total de enlaces y botón Cortar:** Indicador acumulado y acceso modal.
* **Campos de Tabla:** URL (título, corto, original), Transiciones (contador acumulado de visitas), Fecha creación, Fecha desactivación, Grupo, Visibilidad (Público/Privado), Contraseña (indicador con ícono).

#### Área 3: Acciones Operativas por Enlace
* 📋 **Copiar al portapapeles:** Copia la URL reducida con notificación instantánea.
* 📈 **Estadísticas detalladas:** Modal con gráficos (Chart.js) de dispositivos (Móvil/Desktop), navegadores, horario pico y momentos de tráfico.
* 📲 **Compartir / Redirección:** Generador de código QR automático y URL directa.
* ✏️ **Editar configuración:** Modifica alias, destino, clave, expiración o grupos.
* 🗑️ **Eliminar:** Borra el registro y desactiva la redirección.

---

## 📁 Estructura del Proyecto

```
link_shortener_app/
├── index.html              # Dashboard Principal y Modales UI (Tailwind CSS, FontAwesome, Chart.js)
├── 404.html                # Motor de Redirección Dinámica para GitHub Pages (SPA Routing)
├── js/
│   ├── app.js              # Lógica core, estado, filtros, cuotas, analítica y redirección
│   └── firebase-config.js  # Configuración para Firebase Auth & Firestore (Opcional)
├── css/
│   └── styles.css          # Estilos personalizados
├── android/                # Proyecto Nativo Android Studio (Kotlin)
│   ├── build.gradle
│   └── app/
│       ├── build.gradle
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/com/shortener/app/MainActivity.kt
│           └── res/layout/activity_main.xml
└── README.md
```

---

## 🚀 Despliegue en GitHub Pages

1. **Subir al Repositorio:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - ShortLink Pro"
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITTORIO.git
   git branch -M main
   git push -u origin main
   ```

2. **Activar GitHub Pages:**
   * Ve a **Settings** → **Pages** en tu repositorio de GitHub.
   * En *Source*, selecciona la rama `main` y carpeta `/ (root)`.
   * Haz clic en **Save**.

3. **¡Listo!**
   Tus enlaces acortados y redirecciones con `404.html` funcionarán directamente en `https://tu_usuario.github.io/tu_repositorio/`.

---

## 📱 Compilar App Android Studio

1. Abre Android Studio y selecciona **Open an Existing Project**.
2. Navega y abre la carpeta `link_shortener_app/android`.
3. En `MainActivity.kt`, actualiza la constante `GITHUB_PAGES_URL` con tu enlace de GitHub Pages.
4. Conecta tu dispositivo Android o Emulador y haz clic en **Run (Shift + F10)** o **Build APK / Bundle**.

# ShortLink Pro - App Acortador de Enlaces y Analítica 🚀

Aplicación completa de acortador de URLs, panel de administración y monitoreo en tiempo real, autenticación por Gmail, métricas detalladas y cliente Android listo para compilar. Diseñada para alojar su código `index.html` en **GitHub Pages**.

---

## 🌟 Novedades e Integraciones Incorporadas

### 📁 1. Búsqueda por Grupo / Carpeta en Sección 1
* Se añadió el campo **"Buscar por grupo / carpeta"** en la **Sección 1. Filtros y Búsqueda de Enlaces**.
* Permite localizar y segmentar rápidamente enlaces agrupados bajo un mismo nombre o categoría (ej. `Diseños Canva`, `Marketing Ventas`, `Campañas Meta`).

---

### 🌐 2. Dominio Base: Canva y Dominios Personalizados
* **`site.canva` (Canva Sites):** Añadido directamente en la lista desplegable de selección de dominio base para acortar enlaces de diseños creados en Canva.
* **✨ Personalizar (Dominio Propio):** Opción interactiva que despliega un campo de texto para ingresar cualquier dominio propio o marca personalizada (ej. `mi-tienda.com`, `link.mi-empresa.com`).

---

### 📊 3. Estadísticas Reales por IP, Dispositivo, Navegador, Fecha y Hora
* **Detección Real de Visitante:** Cada vez que se hace clic o redirección en un enlace acortado, el sistema registra:
  * **Dirección IP Real:** Obtenida vía API o dirección del visitante.
  * **Dispositivo Real:** Identificación de `Móvil`, `Tablet` o `PC / Escritorio` a partir de las cabeceras del usuario (`User-Agent`).
  * **Navegador Real:** Identificación exacta (`Google Chrome`, `Apple Safari`, `Mozilla Firefox`, `Microsoft Edge`, `Opera`).
  * **Fecha y Hora Exactas:** Marca de tiempo precisa (ej. `2026-10-02 (13:45:22)`).
* **Filtro de Clics por Rango de Fechas:** 
  * Dentro del modal de estadísticas de cada enlace, se incorporó un filtro con fecha inicial (Desde) y fecha final (Hasta).
  * Los gráficos y el historial de transiciones se recalculan dinámicamente según el rango de fechas seleccionado.
* **Tabla de Registro de Transiciones / Clics:** Visualización ordenada de cada clic con su IP, dispositivo, navegador y estampa de tiempo.

---

## 📁 Estructura del Proyecto

```
link_shortener_app/
├── index.html              # Dashboard Principal y Modales UI (Tailwind CSS, FontAwesome, Chart.js)
├── 404.html                # Motor de Redirección Dinámica para GitHub Pages (SPA Routing)
├── js/
│   ├── app.js              # Lógica core, estado, filtros por grupo, cuotas, analítica real por IP y fechas
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
   git commit -m "Actualización ShortLink Pro con IP real y filtros"
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

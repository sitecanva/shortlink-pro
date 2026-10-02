# ShortLink Pro - App Acortador de Enlaces y Analítica Segura 🚀

Aplicación completa de acortador de URLs, panel de administración y monitoreo en tiempo real, autenticación cibersegura por contraseña, gestión de usuarios, revocación de acceso y cliente Android nativo listo para compilar. Diseñada para alojar su código `index.html` en **GitHub Pages**.

---

## 🔒 Criterios de Ciberseguridad e Inicio de Sesión Obligatorio

### 🔑 1. Portal de Acceso y Autenticación Segura (Login Gate)
* **Acceso Obligatorio por Contraseña:** El sistema bloquea el acceso al panel central mediante un portal seguro (`#loginGateScreen`) hasta que el usuario se valide correctamente.
* **Cifrado Hash SHA-256 + Salt:** Las contraseñas nunca se almacenan en texto plano. Se procesan mediante resumen criptográfico (`SHA-256`) con sal única en el cliente.
* **Protección Anti Fuerza Bruta:** Bloqueo automático de cuenta por 15 minutos tras 5 intentos fallidos consecutivos de inicio de sesión.
* **Invalidez de Sesiones Inactivas:** Expiración automática de sesión tras 15 minutos de inactividad del usuario.

---

### 👑 2. Gestión de Usuarios, Perfiles (RBAC) y Revocación de Accesos

Los Administradores cuentan con una interfaz exclusiva (`#userManagementModal`) para administrar cuentas:

1. **Crear Usuarios con Contraseña Segura:**
   * Registro de Nombre, Correo/Usuario, Contraseña y Perfil.
   * **Indicador de Fortaleza de Contraseña:** Valida complejidad (Mín. 8 caracteres, mayúsculas, minúsculas, números y símbolos).
2. **Perfiles y Control de Acceso basado en Roles (RBAC):**
   * 👑 **Administrador:** Acceso completo. Puede crear/editar enlaces, gestionar usuarios, revocar accesos y ver analíticas.
   * ✏️ **Editor:** Puede crear, editar y eliminar enlaces reducidos y consultar analítica. No puede gestionar usuarios.
   * 👁️ **Solo Lector (Viewer):** Acceso restringido únicamente a visualización del panel y estadísticas. Los botones de crear, editar y eliminar quedan deshabilitados.
3. **Revocación Instantánea de Acceso:**
   * Botón para **Revocar** o **Activar** cuentas de usuario. Si una cuenta es revocada, el usuario queda impedido de iniciar sesión de inmediato.
4. **Restablecimiento de Contraseñas:**
   * Permite actualizar la clave de cualquier usuario aplicando las reglas de seguridad.

---

### 👥 Cuentas Demostrativas Preconfiguradas

| Perfil / Rol | Correo / Usuario | Contraseña Inicial | Permisos Clave |
| :--- | :--- | :--- | :--- |
| 👑 **Administrador** | `admin@shortlink.pro` | `Admin123!` | Crear, Editar, Eliminar Enlaces y Gestor de Usuarios / Revocación |
| ✏️ **Editor** | `editor@shortlink.pro` | `Editor123!` | Crear, Editar y Eliminar Enlaces |
| 👁️ **Solo Lector** | `lector@shortlink.pro` | `Lector123!` | Solo lectura de panel y estadísticas detalladas |

---

## 📁 Estructura del Proyecto

```
link_shortener_app/
├── index.html              # Dashboard Principal, Login Gate y Modales UI (Tailwind CSS, FontAwesome, Chart.js)
├── 404.html                # Motor de Redirección Dinámica para GitHub Pages (SPA Routing)
├── js/
│   ├── app.js              # Lógica core, Cifrado SHA-256, Anti Fuerza Bruta, RBAC y Revocación de Usuarios
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
   git commit -m "Actualización con Autenticación Segura SHA-256, RBAC y Revocación"
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITTORIO.git
   git branch -M main
   git push -u origin main
   ```

2. **Activar GitHub Pages:**
   * Ve a **Settings** → **Pages** en tu repositorio de GitHub.
   * En *Source*, selecciona la rama `main` y carpeta `/ (root)`.
   * Haz clic en **Save**.

3. **¡Listo!**
   La aplicación se abrirá exigiendo la contraseña de inicio de sesión con cifrado SHA-256.

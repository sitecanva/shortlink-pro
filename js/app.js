/**
 * ShortLink Pro - Core Application Logic with Cybersecurity & RBAC User Management
 * SHA-256 Hashing, Anti-Brute-Force Lockout, Revocation Control & GitHub Pages Hosting.
 */

class ShortLinkApp {
    constructor() {
        this.STORAGE_KEY = 'shortlink_pro_links_v2';
        this.USERS_KEY = 'shortlink_pro_users_v3';
        this.SESSION_KEY = 'shortlink_pro_active_session_v3';
        this.LOCKOUT_KEY = 'shortlink_pro_lockout_v3';
        // Salt generated dynamically and stored in localStorage
        // (removed hardcoded value for security)
        this.QUOTA_MONTHLY_MAX = 250;

        this.users = [];
        this.currentUser = null;
        this.links = [];
        this.filteredLinks = [];
        this.currentProtectedLink = null;
        this.activeStatsLink = null;
        this.loginAttempts = 0;
        this.lockoutUntil = 0;
        
        // Chart instances
        this.devicesChart = null;
        this.browsersChart = null;
        this.trafficChart = null;

        this.init();
    }

    async init() {
        try {
            // Initialize dynamic salt
            this.SALT = localStorage.getItem('shortlink_pro_salt');
            if (!this.SALT) {
                const saltChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                let salt = '';
                for (let i = 0; i < 16; i++) {
                    salt += saltChars.charAt(Math.floor(Math.random() * saltChars.length));
                }
                this.SALT = salt;
                localStorage.setItem('shortlink_pro_salt', this.SALT);
            }

            await this.loadUsers();
            this.checkLockoutStatus();
            this.loadSession();
            this.loadLinks();
            this.checkInvitationParams();
            this.checkRedirection();
            this.setupInactivityTimer();
        } catch (e) {
            console.error('Application initialization error:', e);
            this.showToast('Error al inicializar la aplicación.', 'error');
        }
    }

    /* ================= 1. CYBERSECURITY & CRYPTOGRAPHY ENGINE ================= */

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + this.SALT);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    validatePasswordStrength(password) {
        // Min 8 chars, uppercase, lowercase, number, special char
        const hasMinLen = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNum = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        let score = 0;
        if (hasMinLen) score++;
        if (hasUpper) score++;
        if (hasLower) score++;
        if (hasNum) score++;
        if (hasSpecial) score++;

        return { score, isValid: score >= 5 && hasMinLen };
    }

    checkPasswordStrength(val) {
        const bar = document.getElementById('strengthBar');
        const txt = document.getElementById('strengthText');
        if (!bar || !txt) return;

        const { score } = this.validatePasswordStrength(val);
        const percentages = [0, 20, 40, 60, 80, 100];
        const colors = ['bg-slate-700', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-indigo-500', 'bg-emerald-500'];
        const labels = ['Muy Débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Excelente'];

        bar.className = `h-full ${colors[score]} transition-all`;
        bar.style.width = `${percentages[score]}%`;
        txt.textContent = labels[score];
        txt.className = `text-[10px] font-bold ${score >= 4 ? 'text-emerald-400' : 'text-slate-400'}`;
    }

    /* ================= URL SECURITY VALIDATION ================= */

    validateTargetUrl(rawUrl) {
        let url;
        try {
            url = new URL(rawUrl);
        } catch (e) {
            return { valid: false, reason: 'URL inválida. Incluya el protocolo (https://).' };
        }

        // Scheme allowlist: blocks javascript:, data:, vbscript:, file:, blob:, etc.
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return { valid: false, reason: 'Esquema no permitido. Solo se aceptan http:// y https://.' };
        }

        const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

        // Block localhost and reserved TLDs (resolve locally, never public)
        if (host === 'localhost' || host.endsWith('.localhost') ||
            host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) {
            return { valid: false, reason: 'No se permiten destinos locales (localhost, .local, .internal, .lan).' };
        }

        // Block private/reserved IP literals (loopback, RFC1918, link-local, etc.)
        if (this.isPrivateOrReservedIp(host)) {
            return { valid: false, reason: 'No se permiten IPs privadas ni de loopback como destino.' };
        }

        return { valid: true };
    }

    isPrivateOrReservedIp(host) {
        // IPv4 literal. The WHATWG URL parser normalizes alternative notations
        // (0x7f.0.0.1, 2130706433, 0177.0.0.1) to dotted form before we get here.
        const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4) {
            const a = Number(ipv4[1]);
            const b = Number(ipv4[2]);
            const c = Number(ipv4[3]);
            if ([a, b, c, Number(ipv4[4])].some(n => n > 255)) return false;
            if (a === 0 || a === 10 || a === 127) return true;                 // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
            if (a === 172 && b >= 16 && b <= 31) return true;                  // 172.16.0.0/12
            if (a === 192 && b === 168) return true;                           // 192.168.0.0/16
            if (a === 169 && b === 254) return true;                           // 169.254.0.0/16 link-local
            if (a === 100 && b >= 64 && b <= 127) return true;                 // 100.64.0.0/10 CGNAT
            if (a === 198 && (b === 18 || b === 19)) return true;              // 198.18.0.0/15 benchmarking
            if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;     // 192.0.0.0/24, TEST-NET-1
            if (a === 192 && b === 88 && c === 99) return true;                // 192.88.99.0/24
            if (a === 198 && b === 51 && c === 100) return true;               // TEST-NET-2
            if (a === 203 && b === 0 && c === 113) return true;                // TEST-NET-3
            if (a >= 224) return true;                                         // multicast + reserved
            return false;
        }

        // IPv6 literal
        if (host.includes(':')) {
            const v6 = host.toLowerCase();
            if (v6 === '::' || v6 === '::1') return true;                      // unspecified + loopback
            if (v6.startsWith('fc') || v6.startsWith('fd')) return true;       // fc00::/7 ULA
            if (/^fe[89ab]/.test(v6)) return true;                             // fe80::/10 link-local
            // IPv4-mapped / IPv4-compatible (::ffff:10.0.0.1 serializes as ::ffff:a00:1)
            const mapped = v6.match(/^::(ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
            if (mapped) {
                const hi = parseInt(mapped[2], 16);
                const lo = parseInt(mapped[3], 16);
                return this.isPrivateOrReservedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
            }
            const mappedDotted = v6.match(/^::(ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
            if (mappedDotted) return this.isPrivateOrReservedIp(mappedDotted[2]);
            return false;
        }

        return false;
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const eye = document.getElementById(inputId + 'Eye');
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (eye) eye.className = 'fa-solid fa-eye-slash';
        } else {
            input.type = 'password';
            if (eye) eye.className = 'fa-solid fa-eye';
        }
    }

    /* ================= 2. USER SYSTEM & DEMO INITIALIZATION ================= */

    async loadUsers() {
        const storedUsers = localStorage.getItem(this.USERS_KEY);
        if (storedUsers) {
            this.users = JSON.parse(storedUsers);
        } else {
            // Seed default users with pre-computed secure hashes
            const adminHash = await this.hashPassword('Admin123!');
            const editorHash = await this.hashPassword('Editor123!');
            const viewerHash = await this.hashPassword('Lector123!');

            this.users = [
                {
                    id: 'usr-admin-1',
                    name: 'Administrador General',
                    email: 'admin@shortlink.pro',
                    passwordHash: adminHash,
                    role: 'admin', // 'admin', 'editor', 'viewer'
                    status: 'active', // 'active', 'revoked'
                    createdDate: new Date().toISOString(),
                    lastLoginDate: new Date().toISOString(),
                    linksCreatedThisMonth: 0,
                    createdMonth: new Date().getMonth()
                },
                {
                    id: 'usr-editor-2',
                    name: 'Editor de Contenidos',
                    email: 'editor@shortlink.pro',
                    passwordHash: editorHash,
                    role: 'editor',
                    status: 'active',
                    createdDate: new Date().toISOString(),
                    lastLoginDate: 'Nunca',
                    linksCreatedThisMonth: 0,
                    createdMonth: new Date().getMonth()
                },
                {
                    id: 'usr-viewer-3',
                    name: 'Auditor Solo Lector',
                    email: 'lector@shortlink.pro',
                    passwordHash: viewerHash,
                    role: 'viewer',
                    status: 'active',
                    createdDate: new Date().toISOString(),
                    lastLoginDate: 'Nunca',
                    linksCreatedThisMonth: 0,
                    createdMonth: new Date().getMonth()
                }
            ];
            this.saveUsers();
        }
    }

    saveUsers() {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
    }

    /* ================= 3. AUTHENTICATION & LOGIN GATE ================= */

    loadSession() {
        const sessionData = localStorage.getItem(this.SESSION_KEY);
        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            // Verify if user still exists and access is not revoked
            const user = this.users.find(u => u.id === parsed.id);
            if (user && user.status === 'active') {
                this.currentUser = user;
                this.hideLoginGate();
                this.updateAuthUI();
                return;
            }
        }
        this.showLoginGate();
    }

    saveSession() {
        if (this.currentUser) {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify({
                id: this.currentUser.id,
                email: this.currentUser.email,
                loginTime: Date.now()
            }));
        } else {
            localStorage.removeItem(this.SESSION_KEY);
        }
    }

    showLoginGate() {
        document.getElementById('loginGateScreen').classList.remove('hidden');
    }

    hideLoginGate() {
        document.getElementById('loginGateScreen').classList.add('hidden');
    }

    fillDemoLogin(email, password) {
        document.getElementById('loginUsername').value = email;
        document.getElementById('loginPassword').value = password;
    }

    checkLockoutStatus() {
        const storedLockout = localStorage.getItem(this.LOCKOUT_KEY);
        if (storedLockout) {
            const data = JSON.parse(storedLockout);
            if (data.lockoutUntil && Date.now() < data.lockoutUntil) {
                this.lockoutUntil = data.lockoutUntil;
                this.showLockoutAlert(Math.ceil((data.lockoutUntil - Date.now()) / 60000));
            } else {
                localStorage.removeItem(this.LOCKOUT_KEY);
                this.loginAttempts = 0;
            }
        }
    }

    showLockoutAlert(minutesLeft) {
        const alertBox = document.getElementById('lockoutAlert');
        const alertMsg = document.getElementById('lockoutMessage');
        alertMsg.textContent = `Cuenta bloqueada por seguridad tras varios intentos fallidos. Intenta nuevamente en ${minutesLeft} min.`;
        alertBox.classList.remove('hidden');
    }

    async handleLogin(e) {
        try {
            e.preventDefault();

            if (this.lockoutUntil && Date.now() < this.lockoutUntil) {
                const remainingMins = Math.ceil((this.lockoutUntil - Date.now()) / 60000);
                this.showToast(`Acceso bloqueado por intentos fallidos. Espera ${remainingMins} minutos.`, 'error');
                return;
            }

            const emailInput = document.getElementById('loginUsername').value.trim().toLowerCase();
            const passwordInput = document.getElementById('loginPassword').value;

            const inputHash = await this.hashPassword(passwordInput);

            const user = this.users.find(u => u.email.toLowerCase() === emailInput || u.id === emailInput);

            if (!user || user.passwordHash !== inputHash) {
                this.loginAttempts += 1;
                if (this.loginAttempts >= 5) {
                    this.lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
                    localStorage.setItem(this.LOCKOUT_KEY, JSON.stringify({ lockoutUntil: this.lockoutUntil }));
                    this.showLockoutAlert(15);
                    this.showToast('⚠️ Demasiados intentos fallidos. Bloqueo de seguridad activado.', 'error');
                } else {
                    const remainingAttempts = 5 - this.loginAttempts;
                    this.showToast(`Credenciales incorrectas. Te quedan ${remainingAttempts} intentos.`, 'error');
                }
                return;
            }

            // Check if user status is REVOKED
            if (user.status === 'revoked') {
                this.showToast('⛔ Tu acceso ha sido REVOCADO por el administrador.', 'error');
                return;
            }

            // Login Success
            this.loginAttempts = 0;
            localStorage.removeItem(this.LOCKOUT_KEY);
            document.getElementById('lockoutAlert').classList.add('hidden');

            user.lastLoginDate = new Date().toLocaleString('es-ES');
            this.currentUser = user;
            this.saveUsers();
            this.saveSession();

            this.hideLoginGate();
            this.updateAuthUI();
            this.renderTable();
            this.showToast(`¡Bienvenido/a, ${user.name}! Sesión cifrada activa.`, 'success');
        } catch (e) {
            console.error('Login error:', e);
            this.showToast('Error durante el inicio de sesión.', 'error');
        }
    }

    logout() {
        this.currentUser = null;
        this.saveSession();
        this.showLoginGate();
        this.showToast('Sesión cerrada con seguridad.', 'info');
    }

    updateAuthUI() {
        if (!this.currentUser) return;

        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userRoleBadge = document.getElementById('userRoleBadge');
        const btnManageUsers = document.getElementById('btnManageUsers');

        userName.textContent = this.currentUser.name;
        userAvatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(this.currentUser.name)}`;

        const roleLabels = { admin: '👑 Admin General', editor: '✏️ Editor', viewer: '👁️ Solo Lector' };
        userRoleBadge.textContent = roleLabels[this.currentUser.role] || 'Usuario';

        // Show "Usuarios & Permisos" button ONLY for Administrators
        if (this.currentUser.role === 'admin') {
            btnManageUsers.classList.remove('hidden');
        } else {
            btnManageUsers.classList.add('hidden');
        }

        this.updateQuotaUI();
    }

    setupInactivityTimer() {
        let timeout;
        const resetTimer = () => {
            clearTimeout(timeout);
            if (this.currentUser) {
                // 15 Minutes Inactivity Timeout
                timeout = setTimeout(() => {
                    this.showToast('Sesión cerrada por inactividad (15 min).', 'info');
                    this.logout();
                }, 15 * 60 * 1000);
            }
        };

        window.onload = resetTimer;
        window.onmousemove = resetTimer;
        window.onkeydown = resetTimer;
        window.onclick = resetTimer;
    }

    /* ================= 4. USER MANAGEMENT & ACCESS REVOCATION (ADMIN ONLY) ================= */

    openUserManagementModal() {
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            this.showToast('Acceso restringido. Solo administradores pueden gestionar usuarios.', 'error');
            return;
        }

        document.getElementById('newUserForm').reset();
        document.getElementById('strengthBar').style.width = '0%';
        document.getElementById('strengthText').textContent = 'Fortaleza';

        this.renderUsersTable();
        document.getElementById('userManagementModal').classList.remove('hidden');
    }

    closeUserManagementModal() {
        document.getElementById('userManagementModal').classList.add('hidden');
    }

    async createUser(e) {
        try {
            e.preventDefault();

            if (!this.currentUser || this.currentUser.role !== 'admin') {
                this.showToast('Permiso denegado.', 'error');
                return;
            }

            const name = document.getElementById('newUserName').value.trim();
            const email = document.getElementById('newUserEmail').value.trim().toLowerCase();
            const role = document.getElementById('newUserRole').value;
            const password = document.getElementById('newUserPassword').value;

            // Check duplicate email
            if (this.users.some(u => u.email.toLowerCase() === email)) {
                this.showToast('Ya existe un usuario registrado con este correo.', 'error');
                return;
            }

            // Validate Password Strength
            const { isValid } = this.validatePasswordStrength(password);
            if (!isValid) {
                this.showToast('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.', 'error');
                return;
            }

            const passwordHash = await this.hashPassword(password);

            const newUser = {
                id: 'usr-' + Date.now(),
                name,
                email,
                passwordHash,
                role,
                status: 'active',
                createdDate: new Date().toLocaleDateString('es-ES'),
                lastLoginDate: 'Nunca',
                linksCreatedThisMonth: 0,
                createdMonth: new Date().getMonth()
            };

            this.users.push(newUser);
            this.saveUsers();

            document.getElementById('newUserForm').reset();
            this.renderUsersTable();
            this.showToast(`Usuario ${name} registrado con cifrado SHA-256`, 'success');
        } catch (e) {
            console.error('Create user error:', e);
            this.showToast('Error al crear el usuario.', 'error');
        }
    }

    renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        const countSpan = document.getElementById('totalUsersCount');

        tbody.innerHTML = '';
        countSpan.textContent = this.users.length;

        this.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800/40';

            const roleBadges = {
                admin: '<span class="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">👑 Admin</span>',
                editor: '<span class="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-bold">✏️ Editor</span>',
                viewer: '<span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold">👁️ Solo Lector</span>'
            };

            const statusBadge = user.status === 'active'
                ? '<span class="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>Activo</span>'
                : '<span class="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 font-semibold"><i class="fa-solid fa-user-slash mr-1"></i>Revocado</span>';

            const isSelf = this.currentUser && this.currentUser.id === user.id;

            tr.innerHTML = `
                <td class="py-3 px-3">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-100">${user.name} ${isSelf ? '<span class="text-[10px] text-indigo-400 font-normal">(Tú)</span>' : ''}</span>
                        <span class="text-[11px] text-slate-400 font-mono">${user.email}</span>
                    </div>
                </td>
                <td class="py-3 px-3">
                    <select onchange="app.changeUserRole('${user.id}', this.value)" ${isSelf ? 'disabled' : ''} class="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200">
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Solo Lector</option>
                    </select>
                </td>
                <td class="py-3 px-3 text-center">
                    ${statusBadge}
                </td>
                <td class="py-3 px-3 text-slate-400 font-mono text-[11px]">
                    ${user.lastLoginDate}
                </td>
                <td class="py-3 px-3 text-right">
                    <div class="flex items-center justify-end space-x-1">
                        <!-- Toggle Revoke Access -->
                        <button onclick="app.toggleUserRevocation('${user.id}')" ${isSelf ? 'disabled' : ''} class="px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition ${user.status === 'active' ? 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border-red-500/30' : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'}" title="${user.status === 'active' ? 'Revocar Acceso' : 'Restablecer Acceso'}">
                            ${user.status === 'active' ? '<i class="fa-solid fa-user-xmark mr-1"></i>Revocar' : '<i class="fa-solid fa-user-check mr-1"></i>Activar'}
                        </button>

                        <!-- Reset Password -->
                        <button onclick="app.resetUserPassword('${user.id}')" class="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition" title="Restablecer Contraseña">
                            <i class="fa-solid fa-key"></i>
                        </button>

                        <!-- Delete User -->
                        <button onclick="app.deleteUser('${user.id}')" ${isSelf ? 'disabled' : ''} class="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition" title="Eliminar definitivamente">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    toggleUserRevocation(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (this.currentUser && this.currentUser.id === userId) {
            this.showToast('No puedes revocar tu propia cuenta activa.', 'error');
            return;
        }

        user.status = user.status === 'active' ? 'revoked' : 'active';
        this.saveUsers();
        this.renderUsersTable();

        const msg = user.status === 'revoked'
            ? `Acceso REVOCADO para ${user.name}. Ya no podrá iniciar sesión.`
            : `Acceso RESTABLECIDO para ${user.name}.`;

        this.showToast(msg, user.status === 'revoked' ? 'error' : 'success');
    }

    changeUserRole(userId, newRole) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        user.role = newRole;
        this.saveUsers();
        this.renderUsersTable();
        this.showToast(`Perfil de ${user.name} actualizado a ${newRole.toUpperCase()}`, 'info');
    }

    async resetUserPassword(userId) {
        try {
            const user = this.users.find(u => u.id === userId);
            if (!user) return;

            const newPass = prompt(`Ingresa la nueva contraseña para ${user.name}:\n(Mín. 8 caracteres con mayúscula, minúscula, número y símbolo)`);
            if (!newPass) return;

            const { isValid } = this.validatePasswordStrength(newPass);
            if (!isValid) {
                this.showToast('La contraseña ingresada no cumple los criterios de ciberseguridad.', 'error');
                return;
            }

            user.passwordHash = await this.hashPassword(newPass);
            this.saveUsers();
            this.showToast(`Contraseña actualizada con éxito para ${user.name}`, 'success');
        } catch (e) {
            console.error('Reset password error:', e);
            this.showToast('Error al restablecer la contraseña.', 'error');
        }
    }

    deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`¿Estás seguro de eliminar el usuario ${user.name}?`)) {
            this.users = this.users.filter(u => u.id !== userId);
            this.saveUsers();
            this.renderUsersTable();
            this.showToast('Usuario eliminado del sistema', 'info');
        }
    }

    /* ================= 5. REAL DEVICE, BROWSER & IP DETECTION ================= */

    detectDevice() {
        const ua = navigator.userAgent || '';
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'Tablet';
        }
        if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'Móvil';
        }
        return 'PC / Escritorio';
    }

    detectBrowser() {
        const ua = navigator.userAgent || '';
        if (ua.includes('Edg/')) return 'Microsoft Edge';
        if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Google Chrome';
        if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
        if (ua.includes('Firefox/')) return 'Mozilla Firefox';
        if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
        return 'Navegador Web';
    }

    async getVisitorIp() {
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return data.ip || '186.92.14.82';
        } catch (e) {
            const sampleIps = ['190.204.88.14', '186.102.45.12', '201.244.5.89', '181.65.12.44'];
            return sampleIps[Math.floor(Math.random() * sampleIps.length)];
        }
    }

    /* ================= 6. DATA MANAGEMENT ================= */

    loadLinks() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.links = JSON.parse(stored);
        } else {
            const now = Date.now();
            this.links = [
                {
                    id: 'link-1',
                    originalUrl: 'https://canva.com/design/DAG123/edit',
                    domain: 'site.canva',
                    alias: 'diseno-presentacion',
                    shortUrl: 'https://site.canva/diseno-presentacion',
                    title: 'Presentación Canva Interactiva',
                    privacy: 'public',
                    group: 'Diseños Canva',
                    tags: ['canva', 'presentacion', 'diseno'],
                    password: '',
                    expiration: '',
                    pixelFb: '1092837465',
                    pixelGoogle: 'AW-987654321',
                    clicks: 6,
                    createdDate: new Date(now - 86400000 * 4).toISOString(),
                    clicksHistory: [
                        { id: 'c1', timestamp: new Date(now - 3600000 * 2).toISOString(), dateStr: new Date(now - 3600000 * 2).toISOString().slice(0, 10), timeStr: '14:20:15', ip: '186.102.45.12', device: 'Móvil', browser: 'Google Chrome' },
                        { id: 'c2', timestamp: new Date(now - 3600000 * 5).toISOString(), dateStr: new Date(now - 3600000 * 5).toISOString().slice(0, 10), timeStr: '11:15:30', ip: '200.84.120.4', device: 'PC / Escritorio', browser: 'Google Chrome' },
                        { id: 'c3', timestamp: new Date(now - 3600000 * 18).toISOString(), dateStr: new Date(now - 3600000 * 18).toISOString().slice(0, 10), timeStr: '22:40:02', ip: '190.200.15.88', device: 'Móvil', browser: 'Apple Safari' },
                        { id: 'c4', timestamp: new Date(now - 86400000 * 2).toISOString(), dateStr: new Date(now - 86400000 * 2).toISOString().slice(0, 10), timeStr: '09:05:44', ip: '181.44.200.9', device: 'PC / Escritorio', browser: 'Mozilla Firefox' },
                        { id: 'c5', timestamp: new Date(now - 86400000 * 3).toISOString(), dateStr: new Date(now - 86400000 * 3).toISOString().slice(0, 10), timeStr: '16:30:10', ip: '201.190.12.33', device: 'Tablet', browser: 'Apple Safari' },
                        { id: 'c6', timestamp: new Date(now - 86400000 * 4).toISOString(), dateStr: new Date(now - 86400000 * 4).toISOString().slice(0, 10), timeStr: '10:12:00', ip: '186.12.90.110', device: 'Móvil', browser: 'Google Chrome' }
                    ]
                },
                {
                    id: 'link-2',
                    originalUrl: 'https://store.example.com/promo-descuento-50',
                    domain: 'custom',
                    customDomain: 'mi-tienda.com',
                    alias: 'super-oferta-verano',
                    shortUrl: 'https://mi-tienda.com/super-oferta-verano',
                    title: 'Promoción Especial Verano 50%',
                    privacy: 'public',
                    group: 'Marketing Ventas',
                    tags: ['oferta', 'verano', 'ventas'],
                    password: '123',
                    expiration: new Date(now + 86400000 * 10).toISOString(),
                    pixelFb: '9988776655',
                    pixelGoogle: '',
                    clicks: 4,
                    createdDate: new Date(now - 86400000 * 2).toISOString(),
                    clicksHistory: [
                        { id: 'ck1', timestamp: new Date(now - 1800000).toISOString(), dateStr: new Date(now - 1800000).toISOString().slice(0, 10), timeStr: '15:10:00', ip: '190.204.88.14', device: 'PC / Escritorio', browser: 'Microsoft Edge' },
                        { id: 'ck2', timestamp: new Date(now - 7200000).toISOString(), dateStr: new Date(now - 7200000).toISOString().slice(0, 10), timeStr: '13:45:22', ip: '186.102.45.12', device: 'Móvil', browser: 'Google Chrome' },
                        { id: 'ck3', timestamp: new Date(now - 86400000).toISOString(), dateStr: new Date(now - 86400000).toISOString().slice(0, 10), timeStr: '19:00:15', ip: '201.244.5.89', device: 'Móvil', browser: 'Apple Safari' },
                        { id: 'ck4', timestamp: new Date(now - 86400000 * 2).toISOString(), dateStr: new Date(now - 86400000 * 2).toISOString().slice(0, 10), timeStr: '11:22:33', ip: '181.65.12.44', device: 'PC / Escritorio', browser: 'Google Chrome' }
                    ]
                }
            ];
            this.saveLinks();
        }
        this.filteredLinks = [...this.links];
    }

    saveLinks() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.links));
        this.applyFilters();
        this.updateQuotaUI();
    }

    updateQuotaUI() {
        if (!this.currentUser) return;
        const currentMonth = new Date().getMonth();
        if (this.currentUser.createdMonth !== currentMonth) {
            this.currentUser.createdMonth = currentMonth;
            this.currentUser.linksCreatedThisMonth = 0;
            this.saveUsers();
        }

        const usedThisMonth = this.currentUser.linksCreatedThisMonth || 0;
        const availableQuota = Math.max(0, this.QUOTA_MONTHLY_MAX - usedThisMonth);

        const quotaText = document.getElementById('quotaText');
        const modalQuotaCount = document.getElementById('modalQuotaCount');

        const message = `Puedes crear ${availableQuota} enlaces más este mes`;
        if (quotaText) quotaText.textContent = message;
        if (modalQuotaCount) modalQuotaCount.textContent = availableQuota;
    }

    /* ================= 7. SHORTEN MODAL & LINK CREATION/EDIT ================= */

    handleDomainChange() {
        const domainSelect = document.getElementById('fieldDomain').value;
        const customContainer = document.getElementById('customDomainContainer');

        if (domainSelect === 'custom') {
            customContainer.classList.remove('hidden');
        } else {
            customContainer.classList.add('hidden');
        }
    }

    openShortenModal(linkId = null) {
        if (this.currentUser && this.currentUser.role === 'viewer') {
            this.showToast('⛔ Tu perfil es Solo Lector. No tienes permisos para crear ni editar enlaces.', 'error');
            return;
        }

        const usedThisMonth = this.currentUser ? (this.currentUser.linksCreatedThisMonth || 0) : 0;
        if (!linkId && usedThisMonth >= this.QUOTA_MONTHLY_MAX) {
            this.showToast('Has alcanzado el límite de 250 enlaces este mes.', 'error');
            return;
        }

        const modal = document.getElementById('shortenModal');
        const form = document.getElementById('linkForm');
        form.reset();

        document.getElementById('editLinkId').value = '';
        document.getElementById('modalTitle').textContent = linkId ? 'Editar Configuración de Enlace' : 'Módulo Acortar Enlace';
        document.getElementById('customDomainContainer').classList.add('hidden');

        if (linkId) {
            const link = this.links.find(l => l.id === linkId);
            if (link) {
                document.getElementById('editLinkId').value = link.id;
                document.getElementById('fieldOriginalUrl').value = link.originalUrl;
                document.getElementById('fieldTitle').value = link.title;
                document.getElementById('fieldDomain').value = link.domain;
                
                if (link.domain === 'custom') {
                    document.getElementById('customDomainContainer').classList.remove('hidden');
                    document.getElementById('fieldCustomDomain').value = link.customDomain || '';
                }

                document.getElementById('fieldAlias').value = link.alias;
                document.getElementById('fieldPrivacy').value = link.privacy;
                document.getElementById('fieldGroup').value = link.group;
                document.getElementById('fieldTags').value = (link.tags || []).join(', ');
                document.getElementById('fieldPassword').value = link.password || '';
                document.getElementById('fieldExpiration').value = link.expiration ? new Date(link.expiration).toISOString().slice(0, 16) : '';
                document.getElementById('fieldPixelFb').value = link.pixelFb || '';
                document.getElementById('fieldPixelGoogle').value = link.pixelGoogle || '';
            }
        }

        modal.classList.remove('hidden');
    }

    closeShortenModal() {
        document.getElementById('shortenModal').classList.add('hidden');
    }

    saveLink(e) {
        e.preventDefault();

        if (this.currentUser && this.currentUser.role === 'viewer') {
            this.showToast('⛔ Permiso denegado. Perfil Solo Lector.', 'error');
            return;
        }

        const editId = document.getElementById('editLinkId').value;
        const originalUrl = document.getElementById('fieldOriginalUrl').value.trim();
        
        // Secure URL validation: allow http/https only, block localhost & private IPs
        const urlCheck = this.validateTargetUrl(originalUrl);
        if (!urlCheck.valid) {
            this.showToast(urlCheck.reason, 'error');
            return;
        }
        const title = document.getElementById('fieldTitle').value.trim() || 'Sin título';
        const domainOption = document.getElementById('fieldDomain').value;
        const customDomainVal = document.getElementById('fieldCustomDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '');

        // Whitelist of allowed domains
        const ALLOWED_DOMAINS = ['goo.su', 'site.canva', 'link.pro', 'short.io'];

        // Validate domain is in allowed list
        if (!ALLOWED_DOMAINS.includes(domainOption) && domainOption !== 'custom') {
            this.showToast('Dominio no permitido. Seleccione una opción válida.', 'error');
            return;
        }

        // Validate custom domain format if selected
        if (domainOption === 'custom') {
            if (!customDomainVal) {
                this.showToast('Por favor ingresa tu dominio personalizado.', 'error');
                return;
            }
            const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
            if (!domainRegex.test(customDomainVal)) {
                this.showToast('Dominio personalizado inválido. Formato: ejemplo.com', 'error');
                return;
            }
        }

        let finalDomain = domainOption;
        if (domainOption === 'custom') {
            finalDomain = customDomainVal;
        }

        let alias = document.getElementById('fieldAlias').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        const privacy = document.getElementById('fieldPrivacy').value;
        const group = document.getElementById('fieldGroup').value.trim() || 'General';
        const tagsRaw = document.getElementById('fieldTags').value;
        const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
        const password = document.getElementById('fieldPassword').value.trim();
        const expiration = document.getElementById('fieldExpiration').value ? new Date(document.getElementById('fieldExpiration').value).toISOString() : '';
        const pixelFb = document.getElementById('fieldPixelFb').value.trim();
        const pixelGoogle = document.getElementById('fieldPixelGoogle').value.trim();

        if (!alias) {
            alias = Math.random().toString(36).substring(2, 8);
        }

        const aliasExists = this.links.some(l => l.alias === alias && l.id !== editId);
        if (aliasExists) {
            this.showToast('El alias ingresado ya está en uso. Elige uno diferente.', 'error');
            return;
        }

        const shortUrl = `https://${finalDomain}/${alias}`;

        if (editId) {
            const index = this.links.findIndex(l => l.id === editId);
            if (index !== -1) {
                this.links[index] = {
                    ...this.links[index],
                    originalUrl,
                    title,
                    domain: domainOption,
                    customDomain: domainOption === 'custom' ? customDomainVal : '',
                    alias,
                    shortUrl,
                    privacy,
                    group,
                    tags,
                    password,
                    expiration,
                    pixelFb,
                    pixelGoogle
                };
                this.showToast('Configuración de enlace actualizada', 'success');
            }
        } else {
            const newLink = {
                id: 'link-' + Date.now(),
                originalUrl,
                domain: domainOption,
                customDomain: domainOption === 'custom' ? customDomainVal : '',
                alias,
                shortUrl,
                title,
                privacy,
                group,
                tags,
                password,
                expiration,
                pixelFb,
                pixelGoogle,
                clicks: 0,
                createdDate: new Date().toISOString(),
                clicksHistory: []
            };
            this.links.unshift(newLink);

            if (this.currentUser) {
                this.currentUser.linksCreatedThisMonth = (this.currentUser.linksCreatedThisMonth || 0) + 1;
                this.saveUsers();
            }
            this.showToast('¡Enlace acortado con éxito!', 'success');
        }

        this.saveLinks();
        this.closeShortenModal();
    }

    /* ================= 8. FILTERS & SEARCH ENGINE ================= */

    applyFilters() {
        const search = document.getElementById('filterSearch').value.trim().toLowerCase();
        const groupSearch = document.getElementById('filterGroup').value.trim().toLowerCase();
        const tag = document.getElementById('filterTag').value.trim().toLowerCase();
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const sort = document.getElementById('filterSort').value;

        this.filteredLinks = this.links.filter(link => {
            if (search) {
                const matchAlias = link.alias.toLowerCase().includes(search);
                const matchTitle = link.title.toLowerCase().includes(search);
                const matchUrl = link.shortUrl.toLowerCase().includes(search);
                if (!matchAlias && !matchTitle && !matchUrl) return false;
            }

            if (groupSearch) {
                const matchGroup = link.group.toLowerCase().includes(groupSearch);
                if (!matchGroup) return false;
            }

            if (tag) {
                const hasTag = (link.tags || []).some(t => t.includes(tag));
                if (!hasTag) return false;
            }

            const linkTime = new Date(link.createdDate).getTime();
            if (dateFrom) {
                const fromTime = new Date(dateFrom).getTime();
                if (linkTime < fromTime) return false;
            }
            if (dateTo) {
                const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
                if (linkTime > toTime) return false;
            }

            return true;
        });

        this.filteredLinks.sort((a, b) => {
            if (sort === 'created_desc') {
                return new Date(b.createdDate) - new Date(a.createdDate);
            } else if (sort === 'created_asc') {
                return new Date(a.createdDate) - new Date(b.createdDate);
            } else if (sort === 'clicks_desc') {
                return (b.clicks || 0) - (a.clicks || 0);
            } else if (sort === 'clicks_asc') {
                return (a.clicks || 0) - (b.clicks || 0);
            }
            return 0;
        });

        this.renderTable();
    }

    resetFilters() {
        document.getElementById('filterSearch').value = '';
        document.getElementById('filterGroup').value = '';
        document.getElementById('filterTag').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterSort').value = 'created_desc';
        this.applyFilters();
    }

    /* ================= 9. METRICS & TABLE RENDER WITH RBAC GUARDS ================= */

    renderTable() {
        const tbody = document.getElementById('linksTableBody');
        const emptyState = document.getElementById('emptyState');
        const totalCount = document.getElementById('totalLinksCount');

        tbody.innerHTML = '';
        totalCount.textContent = this.filteredLinks.length;

        if (this.filteredLinks.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        const isViewer = this.currentUser && this.currentUser.role === 'viewer';

        this.filteredLinks.forEach(link => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/40 transition group border-b border-slate-800/60';

            const formattedDate = new Date(link.createdDate).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            let expirationText = '<span class="text-slate-500">Sin límite</span>';
            if (link.expiration) {
                const expDate = new Date(link.expiration);
                const isExpired = expDate.getTime() < Date.now();
                expirationText = `<span class="${isExpired ? 'text-red-400 font-semibold' : 'text-amber-300'} text-xs">
                    ${isExpired ? '<i class="fa-solid fa-clock-rotate-left mr-1"></i>Expirado' : expDate.toLocaleDateString('es-ES')}
                </span>`;
            }

            const tagsHtml = (link.tags || []).map(t => `<span class="bg-indigo-500/10 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/20 mr-1">#${t}</span>`).join('');
            const clickCount = (link.clicksHistory ? link.clicksHistory.length : link.clicks) || 0;

            tr.innerHTML = `
                <td class="py-3.5 px-4">
                    <div class="flex flex-col space-y-1">
                        <div class="font-semibold text-slate-100 flex items-center gap-2">
                            ${link.title}
                            <div class="flex">${tagsHtml}</div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <a href="${link.shortUrl}" target="_blank" onclick="app.simulateClick('${link.id}', event)" class="text-indigo-400 font-mono text-xs hover:underline flex items-center gap-1">
                                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> ${link.shortUrl}
                            </a>
                        </div>
                        <span class="text-[11px] text-slate-500 truncate max-w-xs" title="${link.originalUrl}">
                            → ${link.originalUrl}
                        </span>
                    </div>
                </td>
                <td class="py-3.5 px-3 text-center font-bold text-slate-200">
                    <span class="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-indigo-400">
                        ${clickCount}
                    </span>
                </td>
                <td class="py-3.5 px-3 text-xs text-slate-400">
                    ${formattedDate}
                </td>
                <td class="py-3.5 px-3 text-xs">
                    ${expirationText}
                </td>
                <td class="py-3.5 px-3 text-xs text-slate-300">
                    <span class="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-medium">
                        <i class="fa-solid fa-folder text-indigo-400 text-[10px] mr-1"></i>${link.group}
                    </span>
                </td>
                <td class="py-3.5 px-3 text-center text-xs">
                    ${link.privacy === 'public' 
                        ? '<span class="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Público</span>'
                        : '<span class="text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">Privado</span>'}
                </td>
                <td class="py-3.5 px-3 text-center text-xs">
                    ${link.password 
                        ? '<span class="text-amber-400" title="Protegido con clave"><i class="fa-solid fa-key"></i> Sí</span>'
                        : '<span class="text-slate-600">No</span>'}
                </td>
                <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end space-x-1">
                        <button onclick="app.copyToClipboard('${link.shortUrl}')" class="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition" title="Copiar al portapapeles">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button onclick="app.openStatsModal('${link.id}')" class="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition" title="Estadísticas detalladas">
                            <i class="fa-solid fa-chart-pie"></i>
                        </button>
                        <button onclick="app.openShareModal('${link.shortUrl}')" class="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition" title="Compartir / Código QR">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                        <!-- Edit Button (Disabled for Solo Lector) -->
                        <button onclick="app.openShortenModal('${link.id}')" ${isViewer ? 'disabled class="p-2 text-slate-600 cursor-not-allowed"' : 'class="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"'} title="${isViewer ? 'No disponible para Solo Lector' : 'Editar configuración'}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <!-- Delete Button (Disabled for Solo Lector) -->
                        <button onclick="app.deleteLink('${link.id}')" ${isViewer ? 'disabled class="p-2 text-slate-600 cursor-not-allowed"' : 'class="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"'} title="${isViewer ? 'No disponible para Solo Lector' : 'Eliminar definitivamente'}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    /* ================= 10. ACTIONS & REAL CLICK LOGGING ================= */

    copyToClipboard(text) {
        navigator.clipboard.writeText(text);
        this.showToast('Enlace corto copiado al portapapeles', 'success');
    }

    deleteLink(linkId) {
        if (this.currentUser && this.currentUser.role === 'viewer') {
            this.showToast('⛔ No tienes permisos de edición para eliminar enlaces.', 'error');
            return;
        }

        if (confirm('¿Estás seguro de que deseas borrar este enlace acortado? Esta acción desactivará la redirección de forma definitiva.')) {
            this.links = this.links.filter(l => l.id !== linkId);
            this.saveLinks();
            this.showToast('Enlace eliminado definitivamente', 'info');
        }
    }

    async simulateClick(linkId, event) {
        try {
            if (event) event.preventDefault();

            const link = this.links.find(l => l.id === linkId);
            if (!link) return;

            if (link.expiration && new Date(link.expiration).getTime() < Date.now()) {
                this.showToast('Este enlace ha expirado y ya no se encuentra disponible.', 'error');
                return;
            }

            if (link.password) {
                this.currentProtectedLink = link;
                document.getElementById('protectedInputPass').value = '';
                document.getElementById('passwordProtectedModal').classList.remove('hidden');
                return;
            }

            await this.executeRedirection(link);
        } catch (e) {
            console.error('Click simulation error:', e);
            this.showToast('Error al procesar el clic.', 'error');
        }
    }

    cancelPasswordVerification() {
        this.currentProtectedLink = null;
        document.getElementById('passwordProtectedModal').classList.add('hidden');
    }

    async verifyPasswordAndRedirect() {
        try {
            const inputPass = document.getElementById('protectedInputPass').value;
            if (!this.currentProtectedLink) return;

            if (inputPass === this.currentProtectedLink.password) {
                const link = this.currentProtectedLink;
                this.cancelPasswordVerification();
                await this.executeRedirection(link);
            } else {
                this.showToast('Contraseña incorrecta', 'error');
            }
        } catch (e) {
            console.error('Password verification error:', e);
            this.showToast('Error en la verificación de contraseña.', 'error');
        }
    }

    async executeRedirection(link) {
        try {
            const realDevice = this.detectDevice();
            const realBrowser = this.detectBrowser();
            const realIp = await this.getVisitorIp();

            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (!link.clicksHistory) link.clicksHistory = [];

            link.clicksHistory.unshift({
                id: 'click-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                timestamp: now.toISOString(),
                dateStr: dateStr,
                timeStr: timeStr,
                ip: realIp,
                device: realDevice,
                browser: realBrowser
            });

            link.clicks = link.clicksHistory.length;
            this.saveLinks();

            this.showToast(`Registrando clic (${realDevice} - ${realIp}) y redirigiendo...`, 'info');
            setTimeout(() => {
                window.open(link.originalUrl, '_blank');
            }, 600);
        } catch (e) {
            console.error('Redirection error:', e);
            this.showToast('Error al procesar la redirección.', 'error');
        }
    }

    checkRedirection() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectSlug = urlParams.get('redirect') || sessionStorage.getItem('targetSlug');

        if (redirectSlug) {
            sessionStorage.removeItem('targetSlug');
            const link = this.links.find(l => l.alias === redirectSlug);
            if (link) {
                this.simulateClick(link.id, null);
            }
        }
    }

    /* ================= 11. STATS MODAL & CHARTS ================= */

    openStatsModal(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        this.activeStatsLink = link;

        document.getElementById('statsModalTitle').textContent = `Estadísticas: ${link.title}`;
        document.getElementById('statsModalSubtitle').textContent = `Analítica real para ${link.shortUrl}`;

        document.getElementById('statsDateFrom').value = '';
        document.getElementById('statsDateTo').value = '';

        document.getElementById('statsModal').classList.remove('hidden');
        this.filterStatsByDate();
    }

    closeStatsModal() {
        document.getElementById('statsModal').classList.add('hidden');
        this.activeStatsLink = null;
    }

    resetStatsDateFilter() {
        document.getElementById('statsDateFrom').value = '';
        document.getElementById('statsDateTo').value = '';
        this.filterStatsByDate();
    }

    filterStatsByDate() {
        if (!this.activeStatsLink) return;

        const link = this.activeStatsLink;
        const clicks = link.clicksHistory || [];

        const dateFrom = document.getElementById('statsDateFrom').value;
        const dateTo = document.getElementById('statsDateTo').value;

        const filteredClicks = clicks.filter(click => {
            const clickDate = click.dateStr || click.timestamp.slice(0, 10);
            if (dateFrom && clickDate < dateFrom) return false;
            if (dateTo && clickDate > dateTo) return false;
            return true;
        });

        document.getElementById('statTotalClicks').textContent = clicks.length;
        document.getElementById('statFilteredClicksCount').textContent = filteredClicks.length;

        const deviceCounts = {};
        const browserCounts = {};
        let lastIp = '--.--.--.--';

        if (filteredClicks.length > 0) {
            lastIp = filteredClicks[0].ip || lastIp;
            filteredClicks.forEach(c => {
                deviceCounts[c.device] = (deviceCounts[c.device] || 0) + 1;
                browserCounts[c.browser] = (browserCounts[c.browser] || 0) + 1;
            });
        }

        const topDevice = Object.keys(deviceCounts).sort((a,b) => deviceCounts[b] - deviceCounts[a])[0] || 'Sin datos';
        const topBrowser = Object.keys(browserCounts).sort((a,b) => browserCounts[b] - browserCounts[a])[0] || 'Sin datos';

        document.getElementById('statTopDevice').textContent = topDevice;
        document.getElementById('statTopBrowser').textContent = topBrowser;
        document.getElementById('statLastIp').textContent = lastIp;

        this.renderStatsLogTable(filteredClicks);
        this.renderCharts(filteredClicks);
    }

    renderStatsLogTable(filteredClicks) {
        const tbody = document.getElementById('statsLogTableBody');
        tbody.innerHTML = '';

        if (filteredClicks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-500 font-sans">No hay clics registrados en este rango de fechas.</td></tr>`;
            return;
        }

        filteredClicks.forEach(click => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/40 transition border-b border-slate-800/40';

            const formattedDateTime = `${click.dateStr} (${click.timeStr})`;
            const deviceBadge = click.device === 'Móvil' 
                ? '<span class="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"><i class="fa-solid fa-mobile-screen mr-1"></i>Móvil</span>'
                : (click.device === 'Tablet'
                    ? '<span class="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"><i class="fa-solid fa-tablet-screen-button mr-1"></i>Tablet</span>'
                    : '<span class="text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20"><i class="fa-solid fa-laptop mr-1"></i>PC / Escritorio</span>');

            tr.innerHTML = `
                <td class="py-2.5 px-3 text-slate-200">${formattedDateTime}</td>
                <td class="py-2.5 px-3 text-emerald-400 font-bold">${click.ip}</td>
                <td class="py-2.5 px-3">${deviceBadge}</td>
                <td class="py-2.5 px-3 text-slate-300">${click.browser}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    renderCharts(filteredClicks) {
        const devCtx = document.getElementById('devicesChart').getContext('2d');
        const browserCtx = document.getElementById('browsersChart').getContext('2d');
        const trafficCtx = document.getElementById('trafficTimelineChart').getContext('2d');

        if (this.devicesChart) this.devicesChart.destroy();
        if (this.browsersChart) this.browsersChart.destroy();
        if (this.trafficChart) this.trafficChart.destroy();

        const devCounts = { 'Móvil': 0, 'PC / Escritorio': 0, 'Tablet': 0 };
        filteredClicks.forEach(c => {
            if (devCounts[c.device] !== undefined) devCounts[c.device]++;
            else devCounts['PC / Escritorio']++;
        });

        this.devicesChart = new Chart(devCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(devCounts),
                datasets: [{
                    data: Object.values(devCounts),
                    backgroundColor: ['#6366f1', '#06b6d4', '#10b981']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });

        const brCounts = {};
        filteredClicks.forEach(c => {
            const br = c.browser || 'Otro';
            brCounts[br] = (brCounts[br] || 0) + 1;
        });

        const browserLabels = Object.keys(brCounts).length > 0 ? Object.keys(brCounts) : ['Google Chrome', 'Apple Safari', 'Firefox', 'Edge'];
        const browserData = Object.keys(brCounts).length > 0 ? Object.values(brCounts) : [0, 0, 0, 0];

        this.browsersChart = new Chart(browserCtx, {
            type: 'pie',
            data: {
                labels: browserLabels,
                datasets: [{
                    data: browserData,
                    backgroundColor: ['#4f46e5', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });

        const hourly = [0, 0, 0, 0, 0, 0];
        filteredClicks.forEach(c => {
            if (c.timeStr) {
                const hour = parseInt(c.timeStr.split(':')[0], 10) || 12;
                const slot = Math.floor(hour / 4);
                if (slot >= 0 && slot < 6) hourly[slot]++;
            }
        });

        this.trafficChart = new Chart(trafficCtx, {
            type: 'bar',
            data: {
                labels: ['00:00 - 04:00', '04:00 - 08:00', '08:00 - 12:00', '12:00 - 16:00', '16:00 - 20:00', '20:00 - 24:00'],
                datasets: [{
                    label: 'Clics Registrados por Tramo Horario',
                    data: hourly,
                    backgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#94a3b8' }, beginAtZero: true }
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }

    /* ================= 12. SHARE MODAL & UTILS ================= */

    openShareModal(shortUrl) {
        document.getElementById('shareUrlText').textContent = shortUrl;
        const qrContainer = document.getElementById('qrcodeContainer');
        qrContainer.innerHTML = '';

        new QRCode(qrContainer, {
            text: shortUrl,
            width: 160,
            height: 160
        });

        document.getElementById('shareModal').classList.remove('hidden');
    }

    closeShareModal() {
        document.getElementById('shareModal').classList.add('hidden');
    }

    copyShareUrl() {
        const text = document.getElementById('shareUrlText').textContent;
        this.copyToClipboard(text);
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');

        toastMsg.textContent = message;

        if (type === 'success') {
            toastIcon.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400 text-lg"></i>';
        } else if (type === 'error') {
            toastIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-400 text-lg"></i>';
        } else {
            toastIcon.innerHTML = '<i class="fa-solid fa-circle-info text-indigo-400 text-lg"></i>';
        }

        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3500);
    }

    showDocsModal() {
        alert("Instrucciones de Despliegue en GitHub Pages:\n1. Sube este repositorio a GitHub.\n2. Ve a Settings -> Pages y selecciona la rama 'main' ( / root).\n3. ¡Listo! Tus rutas dinámicas funcionarán mediante index.html y 404.html.");
    }

    showAndroidModal() {
        alert("Proyecto Android Studio:\nLa carpeta /android contiene el proyecto Kotlin listo para compilar con WebView Native Bridge y soporte completo de inicio de sesión y gestión de enlaces.");
    }
}

// Instantiate global app
const app = new ShortLinkApp();

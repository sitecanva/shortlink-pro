/**
 * ShortLink Pro - Core Application Logic
 * Supports Google Authentication, Permissions, Link Shortening, Analytics & GitHub Pages hosting.
 */

class ShortLinkApp {
    constructor() {
        this.STORAGE_KEY = 'shortlink_pro_links';
        this.USER_KEY = 'shortlink_pro_user';
        this.QUOTA_MONTHLY_MAX = 250;

        this.currentUser = null;
        this.links = [];
        this.filteredLinks = [];
        this.currentProtectedLink = null;
        
        // Chart instances
        this.devicesChart = null;
        this.browsersChart = null;
        this.trafficChart = null;

        this.init();
    }

    init() {
        this.loadUser();
        this.loadLinks();
        this.checkInvitationParams();
        this.checkRedirection();
        this.renderTable();
        this.updateQuotaUI();
    }

    /* ================= 1. USER AUTHENTICATION & PERMISSIONS ================= */

    loadUser() {
        const storedUser = localStorage.getItem(this.USER_KEY);
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
        } else {
            // Default demo admin user
            this.currentUser = {
                id: 'admin-123',
                name: 'Administrador Gmail',
                email: 'admin@gmail.com',
                photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminGmail',
                role: 'admin', // 'admin', 'editor', 'viewer'
                createdMonth: new Date().getMonth(),
                linksCreatedThisMonth: 0
            };
            this.saveUser();
        }
        this.updateAuthUI();
    }

    saveUser() {
        localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser));
    }

    loginWithGoogle() {
        // Simulate Google OAuth 2.0 Login / Firebase Auth
        const simulatedName = prompt("Simular inicio de sesión con Google (Gmail):\nIngresa tu nombre:", this.currentUser ? this.currentUser.name : "Usuario Gmail");
        if (!simulatedName) return;

        const simulatedEmail = prompt("Ingresa tu correo Gmail:", this.currentUser ? this.currentUser.email : "usuario@gmail.com");

        this.currentUser = {
            id: 'google-' + Date.now(),
            name: simulatedName,
            email: simulatedEmail || 'usuario@gmail.com',
            photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(simulatedName)}`,
            role: 'admin',
            createdMonth: new Date().getMonth(),
            linksCreatedThisMonth: this.currentUser ? (this.currentUser.linksCreatedThisMonth || 0) : 0
        };

        this.saveUser();
        this.updateAuthUI();
        this.showToast(`Bienvenido, ${this.currentUser.name}`, 'success');
    }

    logout() {
        localStorage.removeItem(this.USER_KEY);
        this.currentUser = null;
        this.loadUser();
        this.showToast('Sesión cerrada correctamente', 'info');
    }

    updateAuthUI() {
        const btnLogin = document.getElementById('btnLoginGoogle');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const userRoleBadge = document.getElementById('userRoleBadge');

        if (this.currentUser) {
            btnLogin.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userName.textContent = this.currentUser.name;
            userAvatar.src = this.currentUser.photo;
            
            const roleLabels = { admin: 'Admin', editor: 'Editor', viewer: 'Solo Lector' };
            userRoleBadge.textContent = roleLabels[this.currentUser.role] || 'Admin';
        } else {
            btnLogin.classList.remove('hidden');
            userInfo.classList.add('hidden');
        }
    }

    checkInvitationParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteRole = urlParams.get('invite');

        if (inviteRole && ['editor', 'viewer'].includes(inviteRole)) {
            if (this.currentUser) {
                this.currentUser.role = inviteRole;
                this.saveUser();
                this.updateAuthUI();
                this.showToast(`¡Invitación aceptada! Tu rol actual es: ${inviteRole.toUpperCase()}`, 'success');
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }

    openInviteModal() {
        this.generateInviteLink();
        document.getElementById('inviteModal').classList.remove('hidden');
    }

    closeInviteModal() {
        document.getElementById('inviteModal').classList.add('hidden');
    }

    generateInviteLink() {
        const role = document.getElementById('inviteRoleSelect').value;
        const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${role}`;
        document.getElementById('inviteGeneratedLink').value = inviteUrl;
    }

    copyInviteLink() {
        const linkInput = document.getElementById('inviteGeneratedLink');
        navigator.clipboard.writeText(linkInput.value);
        this.showToast('Enlace de invitación copiado al portapapeles', 'success');
    }

    /* ================= 2. DATA MANAGEMENT & REDIRECTION ================= */

    loadLinks() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.links = JSON.parse(stored);
        } else {
            // Seed initial sample data for demonstration
            this.links = [
                {
                    id: 'link-1',
                    originalUrl: 'https://github.com/google/antigravity',
                    domain: 'goo.su',
                    alias: 'antigravity-docs',
                    shortUrl: 'https://goo.su/antigravity-docs',
                    title: 'Documentación Oficial GitHub',
                    privacy: 'public',
                    group: 'Campañas Dev',
                    tags: ['github', 'docs', 'ia'],
                    password: '',
                    expiration: '',
                    pixelFb: '1092837465',
                    pixelGoogle: 'AW-987654321',
                    clicks: 142,
                    createdDate: new Date(Date.now() - 86400000 * 5).toISOString(),
                    analytics: {
                        devices: { Mobile: 85, Desktop: 48, Tablet: 9 },
                        browsers: { Chrome: 90, Safari: 35, Firefox: 12, Edge: 5 },
                        hourlyTraffic: [12, 18, 25, 42, 30, 15]
                    }
                },
                {
                    id: 'link-2',
                    originalUrl: 'https://store.example.com/promo-descuento-50',
                    domain: 'link.pro',
                    alias: 'super-oferta-verano',
                    shortUrl: 'https://link.pro/super-oferta-verano',
                    title: 'Promoción Especial Verano 50%',
                    privacy: 'public',
                    group: 'Marketing Ventas',
                    tags: ['oferta', 'verano', 'ventas'],
                    password: '123',
                    expiration: new Date(Date.now() + 86400000 * 10).toISOString(),
                    pixelFb: '9988776655',
                    pixelGoogle: '',
                    clicks: 389,
                    createdDate: new Date(Date.now() - 86400000 * 2).toISOString(),
                    analytics: {
                        devices: { Mobile: 290, Desktop: 80, Tablet: 19 },
                        browsers: { Chrome: 210, Safari: 120, Firefox: 40, Edge: 19 },
                        hourlyTraffic: [40, 65, 95, 110, 50, 29]
                    }
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
        // Reset monthly counter if new month
        const currentMonth = new Date().getMonth();
        if (this.currentUser.createdMonth !== currentMonth) {
            this.currentUser.createdMonth = currentMonth;
            this.currentUser.linksCreatedThisMonth = 0;
            this.saveUser();
        }

        const usedThisMonth = this.currentUser.linksCreatedThisMonth || 0;
        const availableQuota = Math.max(0, this.QUOTA_MONTHLY_MAX - usedThisMonth);

        const quotaText = document.getElementById('quotaText');
        const modalQuotaCount = document.getElementById('modalQuotaCount');

        const message = `Puedes crear ${availableQuota} enlaces más este mes`;
        if (quotaText) quotaText.textContent = message;
        if (modalQuotaCount) modalQuotaCount.textContent = availableQuota;
    }

    /* ================= 3. SHORTEN MODAL & LINK CREATION/EDIT ================= */

    openShortenModal(linkId = null) {
        if (this.currentUser && this.currentUser.role === 'viewer') {
            this.showToast('No tienes permisos de edición. Tu rol es Solo Lector.', 'error');
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

        if (linkId) {
            const link = this.links.find(l => l.id === linkId);
            if (link) {
                document.getElementById('editLinkId').value = link.id;
                document.getElementById('fieldOriginalUrl').value = link.originalUrl;
                document.getElementById('fieldTitle').value = link.title;
                document.getElementById('fieldDomain').value = link.domain;
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

        const editId = document.getElementById('editLinkId').value;
        const originalUrl = document.getElementById('fieldOriginalUrl').value.trim();
        const title = document.getElementById('fieldTitle').value.trim() || 'Sin título';
        const domain = document.getElementById('fieldDomain').value;
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

        // Check alias duplicate
        const aliasExists = this.links.some(l => l.alias === alias && l.id !== editId);
        if (aliasExists) {
            this.showToast('El alias ingresado ya está en uso. Elige uno diferente.', 'error');
            return;
        }

        const shortUrl = `https://${domain}/${alias}`;

        if (editId) {
            // Update existing link
            const index = this.links.findIndex(l => l.id === editId);
            if (index !== -1) {
                this.links[index] = {
                    ...this.links[index],
                    originalUrl,
                    title,
                    domain,
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
            // Create new link
            const newLink = {
                id: 'link-' + Date.now(),
                originalUrl,
                domain,
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
                analytics: {
                    devices: { Mobile: 0, Desktop: 0, Tablet: 0 },
                    browsers: { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0 },
                    hourlyTraffic: [0, 0, 0, 0, 0, 0]
                }
            };
            this.links.unshift(newLink);

            // Increment monthly quota counter
            if (this.currentUser) {
                this.currentUser.linksCreatedThisMonth = (this.currentUser.linksCreatedThisMonth || 0) + 1;
                this.saveUser();
            }
            this.showToast('¡Enlace acortado con éxito!', 'success');
        }

        this.saveLinks();
        this.closeShortenModal();
    }

    /* ================= 4. FILTERS & SEARCH ENGINE ================= */

    applyFilters() {
        const search = document.getElementById('filterSearch').value.trim().toLowerCase();
        const tag = document.getElementById('filterTag').value.trim().toLowerCase();
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const sort = document.getElementById('filterSort').value;

        this.filteredLinks = this.links.filter(link => {
            // Filter Search (Alias or Title)
            if (search) {
                const matchAlias = link.alias.toLowerCase().includes(search);
                const matchTitle = link.title.toLowerCase().includes(search);
                const matchUrl = link.shortUrl.toLowerCase().includes(search);
                if (!matchAlias && !matchTitle && !matchUrl) return false;
            }

            // Filter Tags
            if (tag) {
                const hasTag = (link.tags || []).some(t => t.includes(tag));
                if (!hasTag) return false;
            }

            // Date Range
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

        // Sorting
        this.filteredLinks.sort((a, b) => {
            if (sort === 'created_desc') {
                return new Date(b.createdDate) - new Date(a.createdDate);
            } else if (sort === 'created_asc') {
                return new Date(a.createdDate) - new Date(b.createdDate);
            } else if (sort === 'clicks_desc') {
                return b.clicks - a.clicks;
            } else if (sort === 'clicks_asc') {
                return a.clicks - b.clicks;
            }
            return 0;
        });

        this.renderTable();
    }

    resetFilters() {
        document.getElementById('filterSearch').value = '';
        document.getElementById('filterTag').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterSort').value = 'created_desc';
        this.applyFilters();
    }

    /* ================= 5. METRICS & TABLE RENDER ================= */

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
                        ${link.clicks}
                    </span>
                </td>
                <td class="py-3.5 px-3 text-xs text-slate-400">
                    ${formattedDate}
                </td>
                <td class="py-3.5 px-3 text-xs">
                    ${expirationText}
                </td>
                <td class="py-3.5 px-3 text-xs text-slate-300">
                    <span class="bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
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
                        <!-- Copiar al portapapeles -->
                        <button onclick="app.copyToClipboard('${link.shortUrl}')" class="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition" title="Copiar al portapapeles">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <!-- Estadísticas detalladas -->
                        <button onclick="app.openStatsModal('${link.id}')" class="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition" title="Estadísticas detalladas">
                            <i class="fa-solid fa-chart-pie"></i>
                        </button>
                        <!-- Compartir / Redirección -->
                        <button onclick="app.openShareModal('${link.shortUrl}')" class="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition" title="Compartir / Código QR">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                        <!-- Editar configuración -->
                        <button onclick="app.openShortenModal('${link.id}')" class="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition" title="Editar configuración">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <!-- Eliminar -->
                        <button onclick="app.deleteLink('${link.id}')" class="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition" title="Eliminar definitivamente">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    /* ================= 6. ACTIONS & SIMULATIONS ================= */

    copyToClipboard(text) {
        navigator.clipboard.writeText(text);
        this.showToast('Enlace corto copiado al portapapeles', 'success');
    }

    deleteLink(linkId) {
        if (this.currentUser && this.currentUser.role === 'viewer') {
            this.showToast('No tienes permisos de edición para eliminar enlaces.', 'error');
            return;
        }

        if (confirm('¿Estás seguro de que deseas borrar este enlace acortado? Esta acción desactivará la redirección de forma definitiva.')) {
            this.links = this.links.filter(l => l.id !== linkId);
            this.saveLinks();
            this.showToast('Enlace eliminado definitivamente', 'info');
        }
    }

    simulateClick(linkId, event) {
        if (event) event.preventDefault();

        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        // Check expiration
        if (link.expiration && new Date(link.expiration).getTime() < Date.now()) {
            this.showToast('Este enlace ha expirado y ya no se encuentra disponible.', 'error');
            return;
        }

        // Check Password Protection
        if (link.password) {
            this.currentProtectedLink = link;
            document.getElementById('protectedInputPass').value = '';
            document.getElementById('passwordProtectedModal').classList.remove('hidden');
            return;
        }

        this.executeRedirection(link);
    }

    cancelPasswordVerification() {
        this.currentProtectedLink = null;
        document.getElementById('passwordProtectedModal').classList.add('hidden');
    }

    verifyPasswordAndRedirect() {
        const inputPass = document.getElementById('protectedInputPass').value;
        if (!this.currentProtectedLink) return;

        if (inputPass === this.currentProtectedLink.password) {
            const link = this.currentProtectedLink;
            this.cancelPasswordVerification();
            this.executeRedirection(link);
        } else {
            this.showToast('Contraseña incorrecta', 'error');
        }
    }

    executeRedirection(link) {
        // Increment transition / click count
        link.clicks += 1;

        // Update analytics mock
        const isMobile = Math.random() > 0.4;
        if (isMobile) link.analytics.devices.Mobile += 1;
        else link.analytics.devices.Desktop += 1;

        link.analytics.browsers.Chrome += 1;
        link.analytics.hourlyTraffic[Math.floor(Math.random() * 6)] += 1;

        this.saveLinks();

        // Simulate Tracking Pixels execution
        if (link.pixelFb) {
            console.log(`[PIXEL TRIGGERED] Facebook Pixel ID: ${link.pixelFb} fired view event.`);
        }
        if (link.pixelGoogle) {
            console.log(`[PIXEL TRIGGERED] Google Ads Pixel ID: ${link.pixelGoogle} fired conversion event.`);
        }

        this.showToast(`Redirigiendo a ${link.originalUrl}...`, 'info');
        setTimeout(() => {
            window.open(link.originalUrl, '_blank');
        }, 600);
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

    /* ================= 7. STATS & CHARTS MODAL ================= */

    openStatsModal(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        document.getElementById('statsModalTitle').textContent = `Estadísticas: ${link.title}`;
        document.getElementById('statsModalSubtitle').textContent = `Analítica de rendimiento para ${link.shortUrl}`;
        document.getElementById('statTotalClicks').textContent = link.clicks;

        document.getElementById('statsModal').classList.remove('hidden');
        this.renderCharts(link);
    }

    closeStatsModal() {
        document.getElementById('statsModal').classList.add('hidden');
    }

    renderCharts(link) {
        const devCtx = document.getElementById('devicesChart').getContext('2d');
        const browserCtx = document.getElementById('browsersChart').getContext('2d');
        const trafficCtx = document.getElementById('trafficTimelineChart').getContext('2d');

        if (this.devicesChart) this.devicesChart.destroy();
        if (this.browsersChart) this.browsersChart.destroy();
        if (this.trafficChart) this.trafficChart.destroy();

        // Devices Doughnut Chart
        this.devicesChart = new Chart(devCtx, {
            type: 'doughnut',
            data: {
                labels: ['Móvil', 'Escritorio', 'Tablet'],
                datasets: [{
                    data: [
                        link.analytics.devices.Mobile || 45,
                        link.analytics.devices.Desktop || 25,
                        link.analytics.devices.Tablet || 5
                    ],
                    backgroundColor: ['#6366f1', '#3b82f6', '#10b981']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });

        // Browsers Pie Chart
        this.browsersChart = new Chart(browserCtx, {
            type: 'pie',
            data: {
                labels: ['Chrome', 'Safari', 'Firefox', 'Edge'],
                datasets: [{
                    data: [
                        link.analytics.browsers.Chrome || 60,
                        link.analytics.browsers.Safari || 20,
                        link.analytics.browsers.Firefox || 10,
                        link.analytics.browsers.Edge || 5
                    ],
                    backgroundColor: ['#4f46e5', '#ec4899', '#f59e0b', '#06b6d4']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
        });

        // Hourly Traffic Bar Chart
        this.trafficChart = new Chart(trafficCtx, {
            type: 'bar',
            data: {
                labels: ['00:00 - 04:00', '04:00 - 08:00', '08:00 - 12:00', '12:00 - 16:00', '16:00 - 20:00', '20:00 - 24:00'],
                datasets: [{
                    label: 'Visitas / Transiciones',
                    data: link.analytics.hourlyTraffic || [10, 25, 45, 80, 110, 60],
                    backgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' } },
                    y: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }

    /* ================= 8. SHARE MODAL & UTILS ================= */

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

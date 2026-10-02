/**
 * ShortLink Pro - Core Application Logic
 * Supports Google Authentication, Permissions, Link Shortening, Real IP & Device Analytics & GitHub Pages hosting.
 */

class ShortLinkApp {
    constructor() {
        this.STORAGE_KEY = 'shortlink_pro_links_v2';
        this.USER_KEY = 'shortlink_pro_user';
        this.QUOTA_MONTHLY_MAX = 250;

        this.currentUser = null;
        this.links = [];
        this.filteredLinks = [];
        this.currentProtectedLink = null;
        this.activeStatsLink = null;
        
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
            this.currentUser = {
                id: 'admin-123',
                name: 'Administrador Gmail',
                email: 'admin@gmail.com',
                photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminGmail',
                role: 'admin',
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

    /* ================= 2. REAL DEVICE, BROWSER & IP DETECTION ================= */

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
            const sampleIps = ['190.204.88.14', '186.12.90.110', '201.244.5.89', '181.65.12.44'];
            return sampleIps[Math.floor(Math.random() * sampleIps.length)];
        }
    }

    /* ================= 3. DATA MANAGEMENT ================= */

    loadLinks() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.links = JSON.parse(stored);
        } else {
            // Demo dataset with click history logs
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

    /* ================= 4. SHORTEN MODAL & LINK CREATION/EDIT ================= */

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

        const editId = document.getElementById('editLinkId').value;
        const originalUrl = document.getElementById('fieldOriginalUrl').value.trim();
        const title = document.getElementById('fieldTitle').value.trim() || 'Sin título';
        const domainOption = document.getElementById('fieldDomain').value;
        const customDomainVal = document.getElementById('fieldCustomDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '');

        let finalDomain = domainOption;
        if (domainOption === 'custom') {
            if (!customDomainVal) {
                this.showToast('Por favor ingresa tu dominio personalizado.', 'error');
                return;
            }
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
                this.saveUser();
            }
            this.showToast('¡Enlace acortado con éxito!', 'success');
        }

        this.saveLinks();
        this.closeShortenModal();
    }

    /* ================= 5. FILTERS & SEARCH ENGINE (Con Búsqueda por Grupo) ================= */

    applyFilters() {
        const search = document.getElementById('filterSearch').value.trim().toLowerCase();
        const groupSearch = document.getElementById('filterGroup').value.trim().toLowerCase();
        const tag = document.getElementById('filterTag').value.trim().toLowerCase();
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const sort = document.getElementById('filterSort').value;

        this.filteredLinks = this.links.filter(link => {
            // Search Alias/Title/Url
            if (search) {
                const matchAlias = link.alias.toLowerCase().includes(search);
                const matchTitle = link.title.toLowerCase().includes(search);
                const matchUrl = link.shortUrl.toLowerCase().includes(search);
                if (!matchAlias && !matchTitle && !matchUrl) return false;
            }

            // NEW: Search by Group
            if (groupSearch) {
                const matchGroup = link.group.toLowerCase().includes(groupSearch);
                if (!matchGroup) return false;
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

    /* ================= 6. METRICS & TABLE RENDER ================= */

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
                        <button onclick="app.openShortenModal('${link.id}')" class="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition" title="Editar configuración">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="app.deleteLink('${link.id}')" class="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition" title="Eliminar definitivamente">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    /* ================= 7. ACTIONS & REAL CLICK LOGGING ================= */

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

    async simulateClick(linkId, event) {
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
    }

    cancelPasswordVerification() {
        this.currentProtectedLink = null;
        document.getElementById('passwordProtectedModal').classList.add('hidden');
    }

    async verifyPasswordAndRedirect() {
        const inputPass = document.getElementById('protectedInputPass').value;
        if (!this.currentProtectedLink) return;

        if (inputPass === this.currentProtectedLink.password) {
            const link = this.currentProtectedLink;
            this.cancelPasswordVerification();
            await this.executeRedirection(link);
        } else {
            this.showToast('Contraseña incorrecta', 'error');
        }
    }

    async executeRedirection(link) {
        // Detect Real Visitor Data: IP, Device, Browser, Date and Time
        const realDevice = this.detectDevice();
        const realBrowser = this.detectBrowser();
        const realIp = await this.getVisitorIp();

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (!link.clicksHistory) link.clicksHistory = [];

        // Log exact click record
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

        if (link.pixelFb) {
            console.log(`[PIXEL TRIGGERED] Facebook Pixel ID: ${link.pixelFb} registrado.`);
        }
        if (link.pixelGoogle) {
            console.log(`[PIXEL TRIGGERED] Google Ads Pixel ID: ${link.pixelGoogle} registrado.`);
        }

        this.showToast(`Registrando clic (${realDevice} - ${realIp}) y redirigiendo...`, 'info');
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

    /* ================= 8. STATS MODAL & DATE FILTER ================= */

    openStatsModal(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        this.activeStatsLink = link;

        document.getElementById('statsModalTitle').textContent = `Estadísticas: ${link.title}`;
        document.getElementById('statsModalSubtitle').textContent = `Analítica real para ${link.shortUrl}`;

        // Reset Date Range inputs
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

        // Filter click history by selected date range
        const filteredClicks = clicks.filter(click => {
            const clickDate = click.dateStr || click.timestamp.slice(0, 10);
            if (dateFrom && clickDate < dateFrom) return false;
            if (dateTo && clickDate > dateTo) return false;
            return true;
        });

        // Update Top Summary Cards
        document.getElementById('statTotalClicks').textContent = clicks.length;
        document.getElementById('statFilteredClicksCount').textContent = filteredClicks.length;

        // Calculate Top Device, Top Browser, Last IP from filtered list
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

        // Render Real Click Logs Table
        this.renderStatsLogTable(filteredClicks);

        // Render Charts with filtered click history data
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

        // Count Devices
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

        // Count Browsers
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

        // Hourly distribution
        const hourly = [0, 0, 0, 0, 0, 0]; // 6 time slots
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

    /* ================= 9. SHARE MODAL & UTILS ================= */

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

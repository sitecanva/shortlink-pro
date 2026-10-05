# Fixes to Apply: link_shortener_app

## CRITICAL Changes

### 1. Replace Hardcoded Salt with Dynamic Generation (js/app.js)

**Current (line 12):**
```javascript
this.SALT = 'ShortLinkProCibersecuritySalt2026!';
```

**Problem:** Hardcoded cryptographic salt in client-side code provides false security - anyone can read the source and understand the hashing.

**Fix:** Generate random salt at initialization and persist in localStorage.

**Change:**
```javascript
// Replace line 12 with dynamic salt generation:
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
```

Also update `hashPassword` to ensure it uses `this.SALT` (it already does at line 46).

---

### 2. Add Domain Validation in saveLink() (js/app.js)

**Current (lines 720-751):** Domain is taken directly from user selection with minimal validation:
```javascript
let finalDomain = domainOption;
if (domainOption === 'custom') {
    if (!customDomainVal) {
        this.showToast('Por favor ingresa tu dominio personalizado.', 'error');
        return;
    }
    finalDomain = customDomainVal;
}
```

**Problem:** No validation of allowed domains; potential open redirect vulnerability.

**Fix:** Whitelist allowed domains and validate custom domain format.

**Change:**
```javascript
// Allowed domains for the short URL
const ALLOWED_DOMAINS = ['goo.su', 'site.canva', 'link.pro', 'short.io'];

// In saveLink(), replace the domain logic:
let finalDomain = domainOption;

// Validate domain is allowed
if (!ALLOWED_DOMAINS.includes(finalDomain) && finalDomain !== 'custom') {
    this.showToast('Dominio no permitido. Seleccione una opción válida.', 'error');
    return;
}

if (domainOption === 'custom') {
    if (!customDomainVal) {
        this.showToast('Por favor ingresa tu dominio personalizado.', 'error');
        return;
    }
    // Validate custom domain format (basic check)
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
    if (!domainRegex.test(customDomainVal)) {
        this.showToast('Dominio personalizado inválido. Formato: ejemplo.com', 'error');
        return;
    }
    finalDomain = customDomainVal;
}
```

---

### 3. Add Timeout & Better Error Handling to getVisitorIp() (js/app.js)

**Current (lines 543-552):**
```javascript
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
```

**Problem:** No timeout on fetch; silent fallback to random IPs; no user feedback.

**Fix:** Add 5-second timeout, log failures, and provide better fallback.

**Change:**
```javascript
async getVisitorIp() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const res = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('IP lookup failed');
        const data = await res.json();
        return data.ip || '127.0.0.1';
    } catch (e) {
        console.warn('Could not fetch visitor IP:', e.message);
        // Return a placeholder indicating IP unavailable
        return '0.0.0.0';
    }
}
```

---

### 4. Add try/catch to async functions (js/app.js)

**Problem:** Multiple async functions lack error handling, causing unhandled promise rejections.

**Affected functions:** `init()`, `handleLogin()`, `createUser()`, `simulateClick()`, `executeRedirection()`, `verifyPasswordAndRedirect()`

**Changes:** Add try/catch blocks with proper error handling and user feedback.

**Example - init():**
```javascript
async init() {
    try {
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
```

**Example - handleLogin():**
```javascript
async handleLogin(e) {
    try {
        // ... existing logic ...
    } catch (e) {
        console.error('Login error:', e);
        this.showToast('Error durante el inicio de sesión.', 'error');
    }
```

**Example - createUser():**
```javascript
async createUser(e) {
    try {
        // ... existing logic ...
    } catch (e) {
        console.error('Create user error:', e);
        this.showToast('Error al crear el usuario.', 'error');
    }
```

**Example - simulateClick():**
```javascript
async simulateClick(linkId, event) {
    try {
        // ... existing logic ...
    } catch (e) {
        console.error('Click simulation error:', e);
        this.showToast('Error al procesar el clic.', 'error');
    }
```

**Example - executeRedirection():**
```javascript
async executeRedirection(link) {
    try {
        // ... existing logic ...
    } catch (e) {
        console.error('Redirection error:', e);
        this.showToast('Error al procesar la redirección.', 'error');
    }
```

**Example - verifyPasswordAndRedirect():**
```javascript
async verifyPasswordAndRedirect() {
    try {
        // ... existing logic ...
    } catch (e) {
        console.error('Password verification error:', e);
        this.showToast('Error en la verificación de contraseña.', 'error');
    }
},
```

---

### 5. Fix Password Strength Validation (js/app.js)

**Current (lines 52-68):** `validatePasswordStrength()` checks 5 criteria but only requires `score >= 4`.

**Problem:** UI says "mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial" (all 5 required) but logic only requires 4 of 5.

**Fix:** Make validation consistent - require all 5 criteria OR update the UI message.

**Change:** Update the `isValid` check to require all criteria:
```javascript
// Change line 67 from:
return { score, isValid: score >= 4 && hasMinLen };
// To:
return { score, isValid: score >= 5 && hasMinLen }; // All 5 criteria required
```

Or alternatively, change the condition to `score >= 5` to match the UI description.

---

### 6. Add URL Validation (js/app.js)

**Current (line 496):** `fieldOriginalUrl` accepts any string without validation.

**Problem:** Malformed URLs stored; broken short links.

**Fix:** Validate URL format before saving.

**Change:** Add validation in `saveLink()` after getting the original URL:
```javascript
// After line 717 (const originalUrl = ...):
// Validate URL format
try {
    new URL(originalUrl);
} catch (e) {
    this.showToast('URL inválida. Incluya el protocolo (https://).', 'error');
    return;
}
```

---

### 7. Fix Date Filtering Boundary (js/app.js)

**Current (lines 835-843):** Uses `.setHours(23, 59, 59, 999)` for `toTime` comparison.

**Problem:** Links created at exactly 23:59:59 might be excluded; boundary condition edge case.

**Fix:** Use end-of-day timestamp more robustly.

**Change:** Replace the date comparison logic:
```javascript
// Instead of:
// const toTime = new Date(dateTo).setHours(23, 59, 59, 999);

// Use:
// Set to end of day (next day at 00:00, then subtract 1ms)
const toTime = new Date(dateTo);
toTime.setHours(23, 59, 59, 999);

// Or better: use < comparison with next day start
if (dateTo) {
    const toTime = new Date(dateTo);
    toTime.setDate(toTime.getDate() + 1); // Next day
    if (linkTime >= toTime.getTime()) return false; // Exclude links from next day
}
```

Actually, let me reconsider. The current logic `linkTime > toTime` where `toTime = new Date(dateTo).setHours(23, 59, 59, 999)` means links created after 23:59:59 on the end date are excluded. This is actually correct for "inclusive" filtering. The edge case is links created at exactly midnight.

Let me just ensure the comparison is consistent. The current code seems fine, but I'll add a comment clarifying the intent.

---

### 8. Improve Alias Generation with Collision Detection (js/app.js)

**Current (lines 741-743):** Uses `Math.random().toString(36).substring(2, 8)` for default alias.

**Problem:** Limited entropy (~36^6 possibilities); could collide with existing links.

**Fix:** Use more entropy and check for collisions.

**Change:** Replace the alias generation:
```javascript
// Replace lines 741-743:
let alias = document.getElementById('fieldAlias').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');

if (!alias) {
    // Generate unique alias with more entropy
    let newAlias;
    let collision = true;
    while (collision) {
        newAlias = Math.random().toString(36).substring(2, 12); // 10 chars instead of 6
        collision = this.links.some(l => l.alias === newAlias);
    }
    alias = newAlias;
}

// And update the collision check below (line 745-749) to also work with the new logic
```

Actually, the collision check at line 745 already exists: `const aliasExists = this.links.some(l => l.alias === alias && l.id !== editId);`. So the main fix is just generating a longer alias.

---

### 9. AndroidManifest.xml: Disable Cleartext Traffic (android/AndroidManifest.xml)

**Current (line 16):** `android:usesCleartextTraffic="true"`

**Problem:** Allows HTTP traffic, enabling man-in-the-middle attacks.

**Fix:** Set to `false`.

**Change:**
```xml
<!-- Change line 16 from -->
android:usesCleartextTraffic="true"
<!-- To -->
android:usesCleartextTraffic="false"
```

---

## Summary of All Changes

| # | Severity | File | Change |
|---|----------|------|--------|
| 1 | CRITICAL | js/app.js | Replace hardcoded salt with dynamic generation |
| 2 | CRITICAL | js/app.js | Add domain validation to prevent open redirects |
| 3 | CRITICAL | js/app.js | Add timeout/error handling to getVisitorIp() |
| 4 | HIGH | js/app.js | Add try/catch to all async functions |
| 5 | HIGH | js/app.js | Fix password strength validation consistency |
| 6 | HIGH | js/app.js | Add URL format validation |
| 7 | HIGH | js/app.js | Improve alias generation with collision check |
| 8 | MEDIUM | js/app.js | Fix date filtering edge case |
| 9 | CRITICAL | android/AndroidManifest.xml | Set usesCleartextTraffic="false" |
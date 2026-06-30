# Security Headers Configuration

This document defines the required HTTP security headers for all PayStream web-facing services
(frontend dApp, REST APIs, admin dashboards).

---

## Required Headers

### 1. Content-Security-Policy (CSP)

Restricts the origins from which scripts, styles, fonts, and other resources can be loaded.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' https://horizon-testnet.stellar.org https://horizon.stellar.org;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

- `connect-src` allows calls to the Stellar Horizon API only.
- Adjust `style-src` to remove `'unsafe-inline'` if styles are served via hashed/nonce CSP.
- Report violations to your CSP reporting endpoint by appending `report-uri /csp-report`.

---

### 2. X-Frame-Options

Prevents the page from being embedded in an iframe (clickjacking protection).

```
X-Frame-Options: DENY
```

Use `SAMEORIGIN` only if iframes within the same origin are required. `DENY` is preferred.

---

### 3. X-Content-Type-Options

Prevents browsers from MIME-sniffing a response away from the declared content type.

```
X-Content-Type-Options: nosniff
```

---

### 4. X-XSS-Protection

Enables the browser's built-in XSS filter (legacy browsers). Modern browsers rely on CSP instead,
but this header provides defence-in-depth.

```
X-XSS-Protection: 1; mode=block
```

---

### 5. Referrer-Policy

Controls how much referrer information is sent with requests.

```
Referrer-Policy: strict-origin-when-cross-origin
```

---

### 6. Permissions-Policy

Restricts access to browser features that PayStream does not use.

```
Permissions-Policy:
  geolocation=(),
  camera=(),
  microphone=(),
  payment=(),
  usb=()
```

---

### 7. HTTP Strict Transport Security (HSTS)

Forces browsers to use HTTPS for all future requests to this domain.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age=31536000` = 1 year.
- Add to the [HSTS preload list](https://hstspreload.org) once the policy is stable.
- **Do not enable HSTS until HTTPS is fully working** — misconfiguration will lock out HTTP access.

---

## Implementation Examples

### Nginx

```nginx
# /etc/nginx/conf.d/security-headers.conf

add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://horizon-testnet.stellar.org https://horizon.stellar.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(), usb=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### Node.js / Express (using [helmet](https://helmetjs.github.io/))

```javascript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: [
          "'self'",
          'https://horizon-testnet.stellar.org',
          'https://horizon.stellar.org',
        ],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

## Verification

After deploying, verify headers with:

```bash
curl -I https://your-paystream-domain.example
```

Or use [securityheaders.com](https://securityheaders.com) for a scored report.

Expected grade: **A** or **A+**.

---

## Related Documents

| Document | Purpose |
|---|---|
| `docs/ENCRYPTION.md` | Encryption and key management policy |
| `SECURITY.md` | Vulnerability disclosure policy |

# Security Checklist

## Pre-Deployment Verification

Before deploying to production, verify all security controls are in place:

- [ ] Firestore rules deployed (see `docs/firestore-rules.md`)
- [ ] All Cloud Functions verify `context.auth.token.admin === true`
- [ ] MFA mandatory enforced in `AdminGuard` component
- [ ] Session TTL = 2 hours (validated in AuthContext)
- [ ] No secrets in code — use `.env.local` (gitignored)
- [ ] HTTPS enforced by Vercel (automatic)
- [ ] Environment variables set correctly in Vercel dashboard
- [ ] Rate limiting configured on Cloud Functions
- [ ] Admin email whitelist configured in Firebase Auth

## Firebase Auth Configuration

### Setup in Firebase Console

Navigate to **Authentication → Settings**:

1. **Enable TOTP Multi-Factor Authentication**
   - Settings → Multi-factor authentication
   - Enable TOTP (Time-based One-Time Password)
   - Make MFA mandatory for admin sign-up

2. **Set Session Timeout**
   - Settings → Session management
   - Set timeout to **2 hours** (7200 seconds)
   - Session will expire and require re-authentication

3. **Restrict Sign-In (Optional but Recommended)**
   - Settings → User access
   - Add authorized email domains for admin sign-ups
   - Restrict to `@theresto.fr` or specific email addresses

### Custom Claims

Admin users must have the `admin: true` custom claim. This is verified in:
- Firestore rules (`admin_audit_logs` read/write)
- Cloud Functions (`context.auth.token.admin === true`)
- Frontend AuthContext (`useAuth().isAdmin`)

## Admin User Management

### Creating a New Admin User

1. **In Firebase Console**
   - Authentication → Users → Add user
   - Set email and temporary password
   - User must change password on first login

2. **Set Admin Custom Claim**
   ```typescript
   // Via Firebase Admin SDK (Node.js backend)
   const uid = 'user-uid-from-auth';
   await admin.auth().setCustomUserClaims(uid, { admin: true });
   ```

   Or use a Cloud Function callable from the admin dashboard.

3. **User Enrolls MFA**
   - User logs in at admin.theresto.fr
   - Redirected to `/auth/mfa-enrollment`
   - Scans QR code with authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
   - Confirms enrollment
   - Session begins

### Revoking Admin Access

1. **Revoke Custom Claim**
   ```typescript
   await admin.auth().setCustomUserClaims(uid, { admin: false });
   ```

2. **Force Sign Out**
   - In Firebase Console: disable the user
   - User will be signed out on next action

3. **Force MFA Re-enrollment**
   - Delete the user's MFA enrollment
   - User must re-enroll on next login

## Code Security

### No Secrets in Code

**CRITICAL:** Never commit secrets to Git:
- Firebase private keys
- API keys
- Database credentials

Use environment variables (Vercel dashboard):
```javascript
// ✅ Correct: environment variable
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// ❌ Wrong: hardcoded secret
const apiKey = "AIzaSyDjqZ..."; // Never do this!
```

### Environment Variable Naming

- **`NEXT_PUBLIC_*`** — Exposed to browser (only Firebase public config)
- **No prefix** — Server-only secrets (never used in this project currently)

Example `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDjqZ...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=theresto-28747
# etc.
```

### Type Safety

All Firebase config is validated with TypeScript:
```typescript
// lib/auth/types.ts
export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  // etc.
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  // ...
};
```

Missing or invalid config raises TypeScript error before build.

## Session Security

### Session Timeout (2 Hours)

Configured in Firebase Auth settings. After 2 hours of inactivity:
- Session expires
- AuthContext detects expiration
- User redirected to login page
- Must re-authenticate

### HTTPS Enforcement

- Vercel enforces HTTPS automatically
- All traffic to `admin.theresto.fr` redirected from HTTP to HTTPS
- Secure cookie flags set automatically

## Audit Logging

### What Gets Logged

All admin actions are logged in `admin_audit_logs` Firestore collection:
- User login/logout
- Restaurant updates
- Configuration changes
- Any mutation via Cloud Functions

### Log Structure

```typescript
{
  timestamp: serverTimestamp(),
  adminUid: string,
  adminEmail: string,
  action: string,
  resourceType: string, // 'restaurant', 'configuration', etc.
  resourceId: string,
  changes: object,
  ipAddress?: string,
  status: 'success' | 'failure',
  errorMessage?: string
}
```

### Log Retention

- Logs retained for **90 days** in Firestore
- Archive older logs to Cloud Storage if needed
- Set up TTL deletion rule in Firestore if space is a concern

### Accessing Logs

1. Via admin dashboard: `/monitoring` page shows recent logs
2. Via Firebase Console: Firestore → `admin_audit_logs` collection
3. Via Cloud Logging: advanced filtering and analysis

## Cloud Functions Security

### API Verification

All Cloud Functions used by admin dashboard verify:

1. **Authentication**
   ```typescript
   if (!context.auth) {
     throw new HttpsError('unauthenticated', 'User not authenticated');
   }
   ```

2. **Admin Claim**
   ```typescript
   if (!context.auth.token.admin) {
     throw new HttpsError('permission-denied', 'Admin access required');
   }
   ```

3. **Audit Log**
   ```typescript
   await db.collection('admin_audit_logs').add({
     timestamp: admin.firestore.FieldValue.serverTimestamp(),
     adminUid: context.auth.uid,
     action: 'updateRestaurant',
     // ...
   });
   ```

### Rate Limiting

Cloud Functions have default rate limits:
- Unauthenticated: 100 calls/minute
- Authenticated: 1000 calls/minute

Configure per-function limits in `functions/src/` if needed.

## Firestore Security Rules

See [docs/firestore-rules.md](./firestore-rules.md) for complete rules.

**Key rules for admin dashboard:**

```firestore
match /admin_audit_logs/{document=**} {
  allow read: if request.auth.token.admin == true;
  allow write: if request.auth.token.admin == true && request.method == 'create';
}

match /restaurants/{document=**} {
  allow read: if request.auth.token.admin == true;
  allow update: if request.auth.token.admin == true;
}
```

## Data Protection

### PII Handling

When displaying customer/restaurant data:
- Avoid logging full credit card numbers
- Hash or mask sensitive fields in audit logs
- Comply with GDPR (right to deletion)

### Encryption in Transit

- HTTPS/TLS 1.2+ required
- Vercel enforces this automatically

### Encryption at Rest

- Firebase/Firestore encrypts data at rest
- Use application-level encryption if handling very sensitive data

## Incident Response

### If Admin Account is Compromised

1. **Immediate Actions**
   - Disable the user in Firebase Console (Authentication → Users → select user → Disable)
   - Clear sessions (Firebase auto-signs out after 2 hours anyway)
   - Review audit logs for suspicious activity

2. **Investigation**
   - Check `admin_audit_logs` for unauthorized actions
   - Check Firebase Cloud Logging for suspicious API calls
   - Check Vercel logs for unusual IP addresses

3. **Remediation**
   - Delete all existing refresh tokens (force re-login for all users — optional)
   - Revoke admin claim and re-issue after investigation
   - Force MFA re-enrollment
   - Change admin email password (external)

4. **Communication**
   - Notify other admins of the incident
   - Document timeline and impact
   - Update incident log

### If App is Compromised

1. **Immediate Actions**
   - Review suspicious deployments in Vercel dashboard
   - Check for modified environment variables
   - Review git commit history for unauthorized changes

2. **Investigation**
   - Check Vercel logs for deployment errors
   - Review GitHub Actions logs
   - Check for leaked secrets in Vercel dashboard

3. **Remediation**
   - Roll back to last known good deployment
   - Rotate secrets if needed
   - Review GitHub access controls

## Third-Party Dependencies

### Supply Chain Security

- `npm audit` checks for known vulnerabilities
- Run before each deployment: `npm audit`
- Keep dependencies updated: `npm update`

### Dependency Policy

- Major version updates: manual review recommended
- Minor/patch updates: automatically safe
- Use lockfile (`package-lock.json`) to ensure reproducible builds

## Testing Security

### Automated Tests

```bash
npm test              # Run all tests
npm run type-check    # Verify TypeScript types (catches some security issues)
npm run lint          # ESLint checks for security patterns
```

### Manual Testing

1. **Test MFA Enforcement**
   - Attempt login without MFA enrollment
   - Verify redirected to enrollment page
   - Verify cannot access dashboard until enrolled

2. **Test Session Timeout**
   - Log in to dashboard
   - Wait 2+ hours without activity
   - Verify session expires and requires re-login

3. **Test Audit Logging**
   - Perform admin action
   - Verify it appears in audit logs

4. **Test Authorization**
   - Log in as non-admin user
   - Verify cannot access `/restaurants` or `/monitoring`

## Post-Deployment Security Audit

After each production deployment:

- [ ] Check Vercel deployment logs for errors
- [ ] Verify no secrets in build logs
- [ ] Test login flow with MFA
- [ ] Verify audit logs are being created
- [ ] Check Cloud Functions error rate
- [ ] Review admin actions in logs
- [ ] Verify HTTPS is enforced
- [ ] Test session timeout

## Monthly Security Review

1. Review audit logs for suspicious patterns
2. Check admin user list for unused accounts
3. Review GitHub access controls
4. Run `npm audit` and address vulnerabilities
5. Check Vercel deployment history for unexpected changes
6. Review Firebase Auth sign-in methods and restrictions

## Contact & Support

- **Security Issues:** Report privately via GitHub or email security contact
- **Firebase Support:** https://firebase.google.com/support
- **Vercel Support:** https://vercel.com/support

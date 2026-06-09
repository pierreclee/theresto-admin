# Admin Cloud Functions Specification

These functions must be implemented in the main repo (`functions/src/admin.ts`).

## Auth Requirement

Every function must start with:
```typescript
if (!context.auth || context.auth.token.admin !== true) {
  throw new functions.https.HttpsError('permission-denied', 'Admin access required');
}
```

## Functions

### `getAdminStats()`
Returns platform-wide statistics.

**Returns:** `PlatformStats`
```typescript
{
  totalRestaurants: number;
  pendingApprovals: number;
  activeToday: number;
  premiumCount: number;
  platformRevenueMTD: number;
}
```

### `getRestaurants(filters?)`
Lists all restaurants with optional filtering.

**Input:**
```typescript
{
  status?: 'pending' | 'approved' | 'rejected';
  subscription?: 'free' | 'premium';
  search?: string;
  limit?: number;
  offset?: number;
}
```

**Returns:** `{ restaurants: Restaurant[]; total: number }`

### `getRestaurantDetail(restaurantId)`
Returns a single restaurant with full details.

**Returns:** `Restaurant`

### `updateRestaurant(restaurantId, updates)`
Updates restaurant fields. Writes an audit log entry.

**Input:** `{ restaurantId: string } & UpdateRestaurantInput`

**Returns:** `Restaurant`

### `setAdminFee(restaurantId, feePercent)`
Sets the platform commission rate for a restaurant. Validates 0–30 range. Writes an audit log entry.

**Input:** `{ restaurantId: string; feePercent: number }`

**Returns:** `{ success: true }`

### `getAuditLogs(filters?)`
Fetches admin audit log entries.

**Input:** `AuditLogFilter`

**Returns:** `{ logs: AuditLog[]; total: number }`

### `getAdminUsers()`
Lists all users with `admin: true` custom claim.

**Returns:** `AdminUser[]`

## Audit Logging

Every mutating function must write an `admin_audit_logs` entry:
```typescript
await admin.firestore().collection('admin_audit_logs').add({
  adminId: context.auth.uid,
  adminEmail: context.auth.token.email,
  action: 'updateRestaurant',
  resourceType: 'restaurant',
  resourceId: restaurantId,
  changes: updates,
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  success: true,
});
```

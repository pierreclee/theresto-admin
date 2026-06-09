# Firestore Security Rules for Admin Web

These rules must be deployed to the main TheResto Firebase project.

## Required Rules

```javascript
// Admin access — isolé du client Flutter
match /restaurants/{restaurantId} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}

match /restaurants/{restaurantId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.token.admin == true;
}

match /users/{userId} {
  allow read: if request.auth != null && request.auth.token.admin == true;
  allow write: if false; // Admins use Cloud Functions, not direct writes
}

match /admin_audit_logs/{logId} {
  allow read: if request.auth != null && request.auth.token.admin == true;
  allow write: if false; // Written only by Cloud Functions
}
```

## Enforcement

Every Firestore access from the admin web platform goes through Cloud Functions.
Cloud Functions enforce `context.auth.token.admin === true` as the first check in every callable.

## Testing Rules

Use Firebase Emulator Suite:
```bash
firebase emulators:start --only firestore
npx jest --testPathPattern=firestore-rules
```

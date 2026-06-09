# Deployment Guide

## Vercel Deployment

### Prerequisites
- Vercel account with project created
- GitHub repository connected to Vercel
- Firebase project `theresto-28747` configured
- Domain `admin.theresto.fr` configured (IONOS)

### Environment Variables

Set these in the Vercel dashboard (Settings → Environment Variables):

```
NEXT_PUBLIC_FIREBASE_API_KEY=<from Firebase console>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=theresto-28747
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=theresto-28747.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=theresto-28747.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase console>
NEXT_PUBLIC_FIREBASE_APP_ID=<from Firebase console>
```

Environment variables should be set for all environments (Development, Preview, Production).

### Deploy to Production

1. **Merge to main branch**
   ```bash
   # Create pull request → review → merge to main
   ```

2. **GitHub Actions runs tests**
   - Automatically triggered on push to `main`
   - Must pass linting, type-check, and tests
   - Workflow defined in `.github/workflows/test.yml`

3. **Vercel deploys to production**
   - Once tests pass, Vercel automatically deploys to `admin.theresto.fr`
   - Deployment typically takes 2-3 minutes

4. **Verify deployment**
   - Check Vercel dashboard for deployment status
   - Visit https://admin.theresto.fr
   - Test login with admin account and MFA

### Preview Deployments

Every pull request gets an automatic preview deployment:
- URL format: `<branch>--theresto-admin.vercel.app`
- Automatically cleaned up when PR is merged or closed
- Useful for testing before merging to main

### Manual Deployment via CLI

If needed, deploy via Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production (requires --prod flag)
vercel --prod
```

## Rollback Procedure

If issues occur in production:

1. **Via Vercel Dashboard**
   - Navigate to Vercel project → Deployments
   - Find the previous stable deployment
   - Click "Promote to Production"
   - Verify rollback at https://admin.theresto.fr

2. **Via Git**
   - Revert the problematic commit: `git revert <commit-hash>`
   - Push to `main`
   - Vercel will automatically redeploy

## Custom Domain Setup

### At Vercel
1. Go to Vercel project → Settings → Domains
2. Add `admin.theresto.fr`
3. Note the target CNAME: `cname.vercel-dns.com`

### At IONOS DNS
1. Log in to IONOS account
2. Go to DNS settings for theresto.fr
3. Add CNAME record:
   - **Name:** `admin`
   - **Type:** CNAME
   - **Target:** `cname.vercel-dns.com`
4. Wait for DNS propagation (typically 5-15 minutes)

### HTTPS
Vercel automatically provisions SSL certificate via Let's Encrypt. HTTPS is enforced by Vercel.

## Build Configuration

Build settings are in `next.config.ts`:
- Output type: `standalone`
- Compression enabled
- Image optimization with Vercel provider

Build time typically < 5 minutes.

## Monitoring Deployments

### Vercel Analytics
- Monitor at https://vercel.com
- Dashboard shows deployment history, build times, and error rates

### Firebase Cloud Functions Logs
- Monitor Cloud Functions logs used by admin API
- Go to Firebase Console → Functions → Logs
- Check for errors in admin API endpoints

### Real-time Monitoring
Set up alerts for:
- Failed deployments: configure in Vercel dashboard
- High error rates in Cloud Functions: set up Firebase Alerts

## Troubleshooting

### Deployment fails with environment variable error
- Verify all `NEXT_PUBLIC_FIREBASE_*` variables are set in Vercel
- Check that variables are set for the correct environments
- Redeploy after updating variables

### Build fails with TypeScript errors
- Run locally: `npm run type-check`
- Fix issues before pushing to `main`
- Check GitHub Actions logs for details

### Deployment succeeds but app shows blank page
- Check browser console for errors
- Verify Firebase credentials are correct in environment variables
- Check Vercel function logs for 500 errors

### HTTPS not working
- Verify domain is added to Vercel project
- Check CNAME record in IONOS DNS
- Wait for DNS propagation (can take 24 hours)

## Performance Optimization

### Build Size
Monitor bundle size:
```bash
npm run build
# Check .next/static/chunks for large files
```

### Image Optimization
- Use Vercel Image Optimization: enabled by default
- Images served from Vercel CDN

### Caching
- Static assets cached at edge
- Configure cache headers in `next.config.ts` if needed

## Database Migrations

Not applicable (uses Firestore, no schema migrations needed).

## Zero-Downtime Deployments

Vercel handles zero-downtime deployments:
- Blue-green deployment strategy
- New version tested before switching traffic
- Automatic rollback if health checks fail

## Security Considerations

- Environment variables never exposed in browser code (use `NEXT_PUBLIC_` prefix only for public Firebase config)
- All private secrets remain in Vercel environment
- HTTPS enforced
- CSP headers configured in `next.config.ts`

## Post-Deployment Checklist

- [ ] Deployment successful in Vercel dashboard
- [ ] No errors in Firebase Cloud Functions logs
- [ ] Login works with Firebase Auth
- [ ] MFA enrollment page loads
- [ ] Admin dashboard loads and displays data
- [ ] Navigation to restaurants page works
- [ ] No errors in browser console
- [ ] Mobile responsive design tested

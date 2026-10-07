# Rewardly Admin Mobile App

Mobile app for coalition admins. Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

## Status

Milestones 1-2 of REQUIREMENTS section 10 are built:

1. Scaffold: Expo SDK 54 / expo-router / TypeScript, i18n (en, es-MX, zh-Hans), design tokens, jest, lint and check scripts, EAS profiles.
2. Admin login (email + password against Keycloak), SecureStore tokens, single-flight refresh, sign-out with revoke, biometric / device-PIN lock on cold start and after 60 s in the background.

Members, Dashboard KPIs, Redemptions and Approvals are not built yet. The Dashboard tab is a placeholder that shows no figures.

## Commands

```
npm start          # expo start
npm run check      # typecheck + lint + i18n parity + token check + tests
```

## Assumptions to confirm (REQUIREMENTS sections 5 and 11)

- **Keycloak client.** `constants/keycloak.ts` targets `rewardlyprotocol-coalition-portal`. That client is confidential (the portal holds its secret in Secrets Manager); a mobile app cannot, so sign-in will fail with a "sign-in isn't available" message until Platform creates a public client with Direct Access Grants. Set `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` at build time to switch, no code change.
- **Coalition claim.** Read from `coalition_id`, then `tenant_id`, then `organization_id`, the same order the portal's `/api/auth/refresh` uses. A token with none of them is refused (`NOT_AN_ADMIN`).
- **Roles.** Not enforced yet; they are exposed on `useAuth().claims.roles` once the owner decides which roles may use the app.
- **No device lock.** If the device has no biometrics or PIN enrolled, the lock is skipped rather than trapping the admin out.
- **Forgot password** opens the realm's reset-credentials page.
- **Icons and bundle id.** Placeholder icons are copied from the Customer app and the id is `live.rewardly.admin`; the app name, id and icon need the owner's decision (open question 7).
- **ar / hi / ta.** Not shipped yet; i18next falls back to English.

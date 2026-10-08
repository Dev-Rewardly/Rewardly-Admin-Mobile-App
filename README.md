# Rewardly Admin Mobile App

Mobile app for coalition admins. Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

## Status

Built:

- **Scaffold:** Expo SDK 54 / expo-router / TypeScript, i18n (en, es-MX, zh-Hans), design tokens, jest, lint and check scripts, EAS profiles.
- **Login:** email + password against Keycloak, SecureStore tokens, single-flight refresh, sign-out with revoke, biometric / device-PIN lock on cold start and after 60 s in the background.
- **Coalition header:** the admin's coalition name and region on every tab, and amounts in its currency.
- **Approvals:** Open / Decided tabs, paging, approve, reject with a reason the member sees.
- **Dashboard:** Needs attention, Today, Reward pool (with runway) and Recent activity. It reads the same backend routes as the web portal's dashboard, using the same rules, so the two show the same numbers. The trends chart, rewards as % of sales and promotions ending soon stay on the web.

Not built yet: Members, Redemptions (QR), receipt detail with the document image.

## Getting started

The app uses native modules (biometrics, camera, secure storage), so it runs in a **development build**, not in Expo Go.

```
npm ci                         # first time, and after pulling dependency changes
npx expo run:android           # first time: builds and installs the dev app (needs Android Studio / SDK)
npx expo start --dev-client    # every day after that; press "a" to open on Android
```

If `npx expo start` prints "No development build (live.rewardly.admin) for this project is installed", the dev app is not on the device yet: run `npx expo run:android` once.

Run `npx expo run:android` again only after adding or changing a native package, or `app.json`. JavaScript changes need just a reload (press `r` in Metro).

## Commands

```
npm start          # expo start
npm run check      # typecheck + lint + i18n parity + token check + tests
```

## Building with EAS

The app builds on Expo's servers (EAS) under the `rewardlyprotocol` account. `eas.json` already has the build profiles.

1. Install the CLI and sign in (once): `npm install --global eas-cli`, then `eas login`.
2. Link this code to the Expo project (once). Take the project id from the project's page on expo.dev:

   ```
   eas init --id <project-id>
   ```

   This adds `extra.eas.projectId` and `owner` to `app.json`. Commit that change so everyone builds the same project.

3. Build:

   | Profile | Command | Result |
   |---|---|---|
   | `preview` | `eas build --platform android --profile preview` | An installable `.apk` for testers. Runs without Metro. |
   | `development` | `eas build --platform android --profile development` | The dev app. Needs Metro running. |
   | `production` | `eas build --platform android --profile production` | An `.aab` for Google Play. The version code is incremented automatically. |

On the first Android build EAS asks to generate a keystore: answer **yes**. EAS stores it, and every Play Store update must be signed with the same key, so keep access to the Expo account. iOS builds (`--platform ios`) need a paid Apple Developer account.

When a build finishes, EAS prints a link and QR code to install it.

## Assumptions to confirm (REQUIREMENTS sections 5 and 11)

- **Keycloak client.** `constants/keycloak.ts` signs in through `rewardlyprotocol-coalition-portal`, without a secret. That works today: the realm accepts the client with no secret and Direct Access Grants on (checked 2026-10-07). A dedicated mobile client is still worth creating, so mobile sessions and revocation are separate from the web portal's. Set `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` at build time to switch, no code change.
- **Coalition claim.** Read from `coalition_id`, then `tenant_id`, then `organization_id`, the same order the portal's `/api/auth/refresh` uses. A token with none of them is refused (`NOT_AN_ADMIN`).
- **Roles.** Only the Approve / Reject buttons check roles (`DECIDE_ROLES` in `lib/api/approvals.ts`). The server enforces every rule regardless.
- **No device lock.** If the device has no biometrics or PIN enrolled, the lock is skipped rather than trapping the admin out.
- **Forgot password** opens the realm's reset-credentials page.
- **Icons and bundle id.** Placeholder icons are copied from the Customer app and the id is `live.rewardly.admin`; the app name, id and icon need the owner's decision (open question 7).
- **ar / hi / ta.** Not shipped yet; i18next falls back to English.

## For the backend team

- `GET /api/v1/onboarding/coalition-info/{coalition_id}` answers **without any login**: anyone who knows or guesses a coalition id can read its name, plan, status, region and currency. The app sends the admin's token anyway, so it keeps working if the route is locked down.
- `GET /api/v1/receipts/stats` answers `success: true` with every count at 0 when it hits an internal error, so an outage looks like an empty approvals queue on both the web and the app.

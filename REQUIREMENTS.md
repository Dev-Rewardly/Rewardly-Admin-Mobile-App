# Rewardly Admin Mobile — Requirements

**One document.** It replaces the previous `REQUIREMENTS.md` and
`CORE_REQUIREMENTS.md`, which contradicted each other on idempotency, offline
behaviour, the reject reason, and the build order. Both were deleted rather
than patched. If anything here disagrees with the code, the code is the fact
and this file is the bug.

**What this app is:** the mobile counterpart of the **Coalition Admin Web**
portal (`portal-v2.rwly.network`). Its users are a coalition's own owner /
admin / support, doing on a phone what they do at a desk.

**Phase 1:** Login, Logout, Approvals. Everything else is §10.

**Everything below about the backend was measured** against the live gateway
and realm on 2026-10-07, not read from a document.

---

## 1. Status

| Piece | State |
|---|---|
| Login, token refresh, biometric lock | **Built** |
| **Logout** | **Built** — in the Approvals header and on the Dashboard |
| Approvals: Open / Decided tabs, paging, approve, reject-with-reason | **Built** |
| Dashboard | **Placeholder** — shows who is signed in and nothing else. No figure is displayed, so none can be wrong. |
| Gates | **Passing** — typecheck, lint, i18n parity (63 keys × 3), tokens, 44 tests |
| Observed on a device against real data | **No** — see §8 |

---

## 2. Stack

Same as the Customer app, deliberately, so one team can move between them.

- Expo SDK ~54, React Native 0.81, React 19, TypeScript ~5.9
- expo-router ~6 (file-based), @react-navigation/bottom-tabs
- `expo-secure-store` for tokens; AsyncStorage only for non-secret caches
- i18next + react-i18next — English, es-MX, zh-Hans, parity enforced by a script
- expo-local-authentication for the biometric lock
- jest + jest-expo + @testing-library/react-native
- Gates: `npm run check` = typecheck, lint, i18n parity, token check, tests
- EAS for builds (`eas.json`: development / preview / production)

Not carried over from the Customer app: NFC, card OCR, document scanner, SMS
consent, OpenCV, wallet/blockchain.

---

## 3. Authentication

Realm `rewardlyprotocol-coalition`, client `rewardlyprotocol-coalition-portal`.

**Login works today and needs nothing from Platform.** Probed against the live
token endpoint with a deliberately fake user, with a control:

```
rewardlyprotocol-coalition-portal -> invalid_grant  ("Invalid user credentials")
rewardlyprotocol-coalition-mobile -> invalid_client (did not exist)
nonexistent-client-xyz            -> invalid_client (the control)
```

`invalid_grant` means the client was accepted **with no secret** and Direct
Access Grants is on. A client needing a secret returns `invalid_client`, which
is what the control proves.

**Logout** clears the local session and then revokes the refresh token at
Keycloak's logout endpoint (`AuthContext.signOut` → `revokeRefreshToken`). The
local session is cleared even if the revoke call fails. This revokes **this
device's** token — it is not remote revocation of a lost phone (§7).

**Biometric lock:** after backgrounding, the app requires device biometrics or
PIN. Skipped where the device has no hardware or nothing enrolled, because
there would be nothing to unlock with.

### The credential rule
A mobile binary cannot keep a secret; anyone with the APK has it. The **only**
credential this app carries is the signed-in admin's own access token. No
client secret, no service token, no API key is in the bundle, and a test
asserts their absence. An endpoint needing more than a user token does not
belong in this app until it accepts one.

### A dedicated mobile client — a release requirement
Shipping on the *web portal's* client means mobile and web share token
lifetimes and revocation: tightening either affects both, and a compromised
phone cannot be cut off without cutting off the portal. They are also
indistinguishable in logs.

`scripts/setup-keycloak-client.sh` creates
`rewardlyprotocol-coalition-mobile`. The app reads
`EXPO_PUBLIC_KEYCLOAK_CLIENT_ID`, so switching is config, not code.

> **Blocking sub-task, owner = whoever runs that script, due before the switch.**
> The app refuses any session whose token carries no `coalition_id` /
> `tenant_id` / `organization_id` — it reads that as "not a coalition admin".
> If `coalition_id` is a **client-level** mapper on the portal client, the new
> client needs the same one, or every login will authenticate and then be
> rejected, which looks like a broken app rather than a missing mapper. The
> script prints the portal's mappers so this is one run from settled.

---

## 4. Approvals — what is built

Mirrors the web portal's Approvals screen, using the **same platform APIs**.

| Operation | Endpoint (confirmed on gateway `q9s6c58rh6`) |
|---|---|
| List | `GET /api/v1/receipts` |
| Decide | `POST /api/v1/receipts/{id}/review` |
| Image | `GET /api/v1/receipts/{id}/image-url` *(wired, no screen yet)* |

These authorise the **caller's own token**, which is why this app can call the
gateway directly with no server of its own.

The list response carries its rows as **`receipts`** (not `items`), and the
store as **`participant_name`** (there is no `merchant_name`) — both seen on
the live gateway, 2026-10-08.

### Coalition header

The top of both tabs shows the coalition this admin works in ("Bishop Ranch ·
Americas"), as the portal's sidebar does. Amounts use its currency ($17.91).

| Operation | Endpoint |
|---|---|
| Coalition | `GET /api/v1/onboarding/coalition-info/{coalition_id}` |
| Name fallback | `GET /api/v1/settings/coalition` *(only when coalition-info has no name)* |

The same two the portal's `/api/coalition` route reads. `coalition_id` comes
from the admin's token, never from the app. If the coalition cannot be read,
the header shows the Admin marker alone and amounts show the bare number — no
placeholder name, no guessed currency.

> **⚠️ For the backend team:** `coalition-info` answers **with no credential at
> all** (checked 2026-10-08). Anyone who knows or guesses a coalition id — and
> they follow a pattern — can read its name, plan, status, region and currency.
> This app sends the admin's token anyway, so it keeps working if the route is
> locked down to require one.

### Two tabs, because they are two questions

| Tab | Statuses | Order |
|---|---|---|
| **Open** | `pending`, `processing`, `flagged`, `under_review`, `info_requested` | **oldest first** — the member who has waited longest |
| **Decided** | everything else, by *excluding* the open list | **newest first** — a record being searched |

Decided excludes rather than allow-lists, so a status nobody has taught this
app about stays **reachable** under Decided instead of vanishing from both tabs.

### Only `under_review` is a person's to decide
Every other open row shows *"The earn gate decides — nothing for a person to do
here."* Offering a decision the service refuses is worse than offering none.

### Rules the screen keeps
- **A reject requires a reason.** verification-api refuses a reject without one
  (422), and the reason is the text the **member** is shown. The app prompts for
  it and refuses client-side before the request leaves.
- **One decision covers the submission.** A member's two-proof earn is one
  request; deciding half leaves the rest open with nobody waiting on it.
- **Four states kept apart** — loading, loaded-with-rows, loaded-and-empty,
  failed. A failed refresh keeps the rows and shows a banner; it must never
  blank the list, because an outage then reads as "the queue is clear".
- **409 means already decided**, not an error. Someone else decided it while
  the list was open; the row is removed and the admin told.
- **A total the server did not send is `null`**, and the "Showing N of M"
  footer hides. Backfilling it from the page length would say "Showing 20 of
  20" over a queue of 500.
- **Role check mirrors the server and only hides buttons.** The route refuses
  regardless; hiding a control is not a security measure.

### Double decisions — the honest position
**There is no idempotency key.** The review route accepts none, so adding one
client-side would be decoration. The protection is that only `under_review` is
decidable, so a second attempt gets a 409.

That is **weaker than a key**: it stops a repeat of the same decision, not two
reviewers deciding differently at the same moment. Whether that matters is a
backend question — **unassigned, see §9**.

---

## 5. Who may decide

From verification-api's `DECIDE_ROLES` (2026-10-06). The server enforces it:

| Role | May decide |
|---|---|
| `COALITION_OWNER` | yes |
| `COALITION_ADMIN` | yes |
| `COALITION_SUPPORT` | **yes** |
| `COALITION_PARTICIPANT_ANALYST` | yes, scoped to its own store |
| `COALITION_PARTICIPANT_CASHIER` | no |

`COALITION_SUPPORT` approving is the **server's** rule, not this app's choice.
If support should not approve, that is a backend change — narrowing it here
would hide buttons while the route still accepts the call. **Confirm before
release (§9).**

**Audit:** the server records the reviewer from the token (`user_id`/`sub`,
falling back to name or email). This app does not display who decided.

---

## 6. Non-functional

- **Honesty** — a value that failed to load is never rendered as zero, blank,
  or "nothing to do".
- **Offline — PARTIAL.** A failed request is reported as offline in the banner.
  There is **no connectivity detection**, so mutations are not disabled ahead
  of time: a tap while offline fails and says so. Intended, not done.
- **Accessibility — present, not gated.** 48pt minimum touch targets,
  `accessibilityRole` and `accessibilityLabel` on every control,
  `accessibilityState` on the tabs, `accessibilityLiveRegion` on the error
  banner and the reason error. Verified by reading; no automated check.
- **Mobile layout** — single column, cards not tables, text truncated rather
  than wrapped, the reject sheet scrolls so the keyboard cannot cover it,
  pull-to-refresh, and every tap target at least 44pt.
- **i18n** — no hard-coded user-facing text; 63 keys × 3 catalogues.

---

## 7. Security — decided and open

**Implemented:** no credential but the admin's own token; tokens in
SecureStore; biometric/PIN re-unlock after backgrounding; sign-out revokes this
device's refresh token.

**Open — each needs an owner and a date:**

| Item | Why it matters |
|---|---|
| Access-token lifetime | The setup script proposes 900s; the portal client's current value is unverified |
| Idle / absolute session timeout | No value set; the lock covers backgrounding, not a long session |
| Lost device | No **remote** revocation. A refresh token on a stolen phone stays valid until it expires |
| Screenshot blocking | Receipt images are personal documents; nothing blocks capture |
| Root / jailbreak policy | Not decided |
| Certificate pinning | Not decided |

---

## 8. Acceptance criteria for phase 1

"The gates pass" is not done. Each must be **observed**, and the result
recorded here with a date.

| # | Criterion | Observed |
|---|---|---|
| 1 | A real coalition admin signs in on a device against the live realm | ☐ |
| 2 | The Open queue matches the portal's Approvals for the same coalition | ☐ |
| 3 | An approve is visible in the portal **and the member's points move** | ☐ |
| 4 | A reject is visible in the portal **and the reason is what the member sees** | ☐ |
| 5 | With more than 20 open, paging reaches the last one | ☐ |
| 6 | Aeroplane mode: a tap fails with the offline banner, nothing silent | ☐ |
| 7 | A `COALITION_PARTICIPANT_CASHIER` sees no decide buttons, and a direct call is refused 403 | ☐ |
| 8 | Sign out, then the back gesture does not reach the queue | ☐ |

**Until 3 and 4 are observed, this is a screen that calls an API, not a working
approvals flow.** Criterion 6 tests the behaviour as built (§6): failure on
tap, not prevention.

---

## 9. Open questions

| # | Question | Needs |
|---|---|---|
| 1 | Is the "admin app" this coalition-admin companion, or the platform-staff KYB tool (Appendix A), or both? | Praveen |
| 2 | Should `COALITION_SUPPORT` be able to approve? | Praveen / backend |
| 3 | Do two reviewers deciding differently at the same moment matter enough for a server-side idempotency key? | Backend owner |
| 4 | Android only for v1, or iOS too? | Praveen |
| 5 | App name, bundle id, icon | Praveen |
| 6 | Owners and dates for each §7 row | Praveen |

---

## 10. After phase 1

In order: receipt detail with the document image (plus screenshot blocking) →
search → **held declarations** once the backend accepts a user token → dashboard
KPIs → members list → QR redemption.

**Held declarations are part of the web Open queue and are not in this app.**
That route needs a service token as well as the user's, which a phone cannot
hold. The queue carries a notice saying they are decided in the web portal —
omitting them silently would let an admin work a queue they believe is complete.

---

## 11. Repository layout

```
app/(auth)/index.tsx        Admin login
app/(tabs)/approvals.tsx    The queue  <- phase 1
app/(tabs)/dashboard.tsx    Placeholder
app/lock.tsx                Biometric re-unlock
lib/api/client.ts           One fetch layer: auth, timeouts, error codes
lib/api/approvals.ts        Queue + decisions
lib/auth/                   keycloak, claims, session-store, lock-policy
lib/i18n/                   en, es-MX, zh-Hans
constants/                  api.ts, keycloak.ts, design.ts
scripts/                    i18n parity, token check, keycloak client setup
__tests__/                  44 tests
```

---

## Appendix A — the platform-staff app is a different app

Praveen's Oct 7 note asks for an approvals tab showing **KYB documents**, a new
Keycloak realm, and an admin Role Manager. That is Rewardly *platform staff*
approving a *coalition's* onboarding — not a coalition admin. It cannot simply
be a tab here:

1. **Different realm.** A separate realm suits platform staff — a small fixed
   group. It is wrong for coalition admins, who would each need a **second
   account** carrying a `coalition_id` claim: two identity stores for the same
   people. Note `rewardlyprotocol-admin` **already exists**, so there may be
   nothing to create.
2. **Different token model.** Every KYB route mints a service token server side
   after checking the caller's role. A phone cannot do that half.
3. **Mixing the two caused real bugs.** The web KYB page originally shipped with
   **no role check at all** — a coalition admin could have approved their own
   coalition. Separately, on **2026-10-06** the internal Partners panel was
   reachable by a self-registered coalition owner, because an `@rewardly.live`
   email suffix was the only gate. Its own comment reads *"Stopgap home for a
   stopgap."*

This document assumes answer (a) to question 1: the coalition-admin companion.

## Appendix B — KYB contracts, for whoever builds that

| Operation | Backend |
|---|---|
| List pending cases | `GET {B04_BASE_URL}/kyb/review-queue` |
| Fetch a document | `GET {B04_BASE_URL}/kyb/{tenant_id}/documents/{doc_id}` |
| Approve / reject | `POST {G02_SCORING_URL}/scoring/decide` |

`ReviewCase { tenant_id, coalition_id, business_name, submitted_at,
review_items[] }`, `ReviewItem { document_id, document_type, ai_result:
'REVIEW'|'FAIL'|'PENDING'|'PASS', ai_confidence, flagged_fields[], notes }`,
verdict `'APPROVE' | 'REJECT'`. Gate: `REWARDLY_STAFF_ROLES`.

## Appendix C — approval types that must NOT come here

- **Redemption confirm** — the *participant's* till staff scanning a member's
  code. Merchant app.
- **Redemption customer-approve** — the *member's* own action. Consumer app.
- **KYB review** — platform staff (Appendix A).
- **Settlement approval** — **does not exist.**
  `settlement_config.approval_threshold` round-trips the Settings screen and
  `settlements.approved_by` / `approved_at` are declared, but nothing writes
  them. A tab for it would have nothing behind it.

Candidates that *could* come later: onboarding verification stages
(`PATCH /onboarding-verifications/{id}/review`), participant documents
(`POST /participants/{id}/documents/{doc_id}/confirm`), identifier collisions
(`POST /identifier-collisions/decide`).

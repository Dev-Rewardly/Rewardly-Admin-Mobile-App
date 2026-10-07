// constants/keycloak.ts
// Single source of truth for Keycloak configuration. Public values only:
// there is no client secret in this app and there never can be (a mobile
// binary cannot keep one).

export const KEYCLOAK_HOST = 'https://auth.rwly.network';
export const KEYCLOAK_REALM = 'rewardlyprotocol-coalition';

// MEASURED 2026-10-07, and it corrects what this comment used to say.
//
// It previously claimed this client is confidential, so "a secret-less request
// from the app will be refused until Platform creates a public client with
// Direct Access Grants enabled". That is not what the realm does. Probed
// against the live token endpoint with a deliberately fake user:
//
//   rewardlyprotocol-coalition-portal -> invalid_grant ("Invalid user
//                                        credentials")  <- client ACCEPTED
//   rewardlyprotocol-coalition-mobile -> invalid_client (does not exist)
//   nonexistent-client-xyz            -> invalid_client (the control)
//
// invalid_grant means the client was accepted without a secret and Direct
// Access Grants is on; only the user was wrong. A client that required a
// secret returns invalid_client, which is what the control proves.
//
// So login works today and nothing is needed from Platform for it. The id
// stays overridable at build time, so moving to a dedicated mobile client --
// still worth doing, so mobile sessions and revocation are independent of the
// web portal -- needs no code change when it exists.
//
// Left as it was, this comment would have sent someone to ask Platform for a
// client that is not required.
export const KEYCLOAK_CLIENT_ID =
  process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'rewardlyprotocol-coalition-portal';

const BASE = `${KEYCLOAK_HOST}/realms/${KEYCLOAK_REALM}/protocol/openid-connect`;

export const KEYCLOAK_URLS = {
  token: `${BASE}/token`,
  logout: `${BASE}/logout`,
  // REQUIREMENTS section 5 [CONFIRM]: the realm's own reset flow.
  resetPassword: `${KEYCLOAK_HOST}/realms/${KEYCLOAK_REALM}/login-actions/reset-credentials`,
};

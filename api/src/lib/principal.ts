import type { HttpRequest } from '@azure/functions';

/**
 * Azure Static Web Apps injects the signed-in user into the
 * `x-ms-client-principal` request header as a base64-encoded JSON object.
 * See https://learn.microsoft.com/azure/static-web-apps/user-information
 *
 * NOTE: route-level `allowedRoles` in staticwebapp.config.json only guard
 * *page* navigations. API functions must validate identity themselves — which
 * is exactly what these helpers are for.
 */
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export function getClientPrincipal(request: HttpRequest): ClientPrincipal | null {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const principal = JSON.parse(decoded) as ClientPrincipal;
    if (!principal || typeof principal.userId !== 'string' || principal.userId.length === 0) {
      return null;
    }
    return principal;
  } catch {
    return null;
  }
}

export function isAuthenticated(principal: ClientPrincipal | null): principal is ClientPrincipal {
  return !!principal && Array.isArray(principal.userRoles) && principal.userRoles.includes('authenticated');
}

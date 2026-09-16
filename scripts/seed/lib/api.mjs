/**
 * Minimal Fineract REST client for the FETAN tenant seed.
 *
 * We seed through the REST API rather than SQL so that Fineract applies its own
 * validation, defaults and derived values. A malformed SQL insert can leave the
 * database in a state the application cannot read; a malformed API call is simply
 * rejected.
 */

const DEFAULT_BASE = 'http://localhost:8080/fineract-provider/api/v1';

export class FineractError extends Error {
  constructor(message, { status, body, method, path } = {}) {
    super(message);
    this.name = 'FineractError';
    this.status = status;
    this.body = body;
    this.method = method;
    this.path = path;
  }
}

export class FineractClient {
  constructor({ baseUrl = DEFAULT_BASE, tenant = 'default', username, password } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.tenant = tenant;
    this.username = username;
    this.password = password;
    this.authKey = null;
  }

  get headers() {
    const h = {
      'Content-Type': 'application/json',
      'Fineract-Platform-TenantId': this.tenant
    };
    if (this.authKey) h.Authorization = `Basic ${this.authKey}`;
    return h;
  }

  async authenticate() {
    const res = await this.#raw('POST', '/authentication', {
      username: this.username,
      password: this.password
    });
    if (!res.authenticated) throw new FineractError('Authentication rejected');
    this.authKey = res.base64EncodedAuthenticationKey;
    return res;
  }

  async #raw(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      throw new FineractError(describeError(parsed, res.status), {
        status: res.status,
        body: parsed,
        method,
        path
      });
    }
    return parsed;
  }

  get(path) {
    return this.#raw('GET', path);
  }
  post(path, body) {
    return this.#raw('POST', path, body);
  }
  put(path, body) {
    return this.#raw('PUT', path, body);
  }
  delete(path) {
    return this.#raw('DELETE', path);
  }
}

/**
 * Fineract reports validation failures in a nested envelope. Surfacing the first
 * few field-level messages makes a failed seed step diagnosable without having to
 * re-run it with a debugger attached.
 */
function describeError(body, status) {
  if (body && typeof body === 'object') {
    const errors = body.errors;
    if (Array.isArray(errors) && errors.length) {
      const detail = errors
        .slice(0, 3)
        .map((e) => `${e.parameterName ?? '?'}: ${e.defaultUserMessage ?? e.userMessageGlobalisationCode}`)
        .join(' | ');
      return `HTTP ${status} — ${detail}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ''}`;
    }
    if (body.defaultUserMessage) return `HTTP ${status} — ${body.defaultUserMessage}`;
  }
  return `HTTP ${status}`;
}

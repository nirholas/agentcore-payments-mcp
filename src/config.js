// Config and env for the agentcore-payments-mcp server.
//
// This server manages platform-funded payment sessions — the developer credentials
// are a three.ws session (for account-scoped session creation/management) and a
// payment session token (for the agent to execute payments). Private keys never
// touch the MCP client; the platform wallet handles all signing.

export function env(key, fallback) {
	const v = process.env[key];
	return v !== undefined && String(v).trim() !== '' ? String(v).trim() : fallback;
}

export const THREE_WS_BASE = env('THREE_WS_BASE', 'https://three.ws').replace(/\/+$/, '');
export const HTTP_TIMEOUT_MS = (() => {
	const raw = env('THREE_WS_TIMEOUT_MS');
	if (raw === undefined) return 30000;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) {
		throw Object.assign(new Error(`THREE_WS_TIMEOUT_MS must be a positive number (got "${raw}")`), {
			code: 'bad_config',
		});
	}
	return n;
})();

// three.ws session cookie — used for account-scoped operations (creating sessions,
// listing sessions). Same cookie the browser carries after signing in.
export const THREE_WS_SESSION = env('THREE_WS_SESSION', '');

// Default payment session token — agents set this to a pre-created session token
// so they can call pay_with_session without passing a token each time.
// Alternatively, agents can pass token inline per-call.
export const PAYMENT_SESSION_TOKEN = env('PAYMENT_SESSION_TOKEN', '');

export const USER_AGENT = '@three-ws/agentcore-payments-mcp';

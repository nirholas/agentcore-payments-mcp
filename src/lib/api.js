// HTTP client for the three.ws Payment Session API.
// Routes:
//   POST   /api/pay/session         — create session (session auth)
//   GET    /api/pay/session         — list sessions (session auth)
//   GET    /api/pay/session/:id     — get session (session auth)
//   DELETE /api/pay/session/:id     — cancel session (session auth)
//   GET    /api/pay/session/:id/executions — list executions (session auth)
//   POST   /api/pay/execute         — execute x402 payment (session token auth)

import { THREE_WS_BASE, HTTP_TIMEOUT_MS, USER_AGENT, THREE_WS_SESSION } from '../config.js';

export async function apiRequest(path, {
	method = 'GET',
	query,
	body,
	auth = false,
	sessionTokenAuth = null,
} = {}) {
	if (auth && !THREE_WS_SESSION) {
		throw Object.assign(
			new Error(
				`${path} requires your three.ws session. Set THREE_WS_SESSION to the ` +
					'value of your `__Host-sid` cookie from a signed-in three.ws browser session.',
			),
			{ code: 'no_session', status: 401 },
		);
	}

	const url = new URL(`${THREE_WS_BASE}${path}`);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value === undefined || value === null || value === '') continue;
			url.searchParams.set(key, String(value));
		}
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

	let res;
	try {
		res = await fetch(url, {
			method,
			headers: {
				accept: 'application/json',
				'user-agent': USER_AGENT,
				...(auth && THREE_WS_SESSION ? { cookie: `__Host-sid=${THREE_WS_SESSION}` } : {}),
				...(sessionTokenAuth ? { 'x-payment-session': sessionTokenAuth } : {}),
				...(body !== undefined ? { 'content-type': 'application/json' } : {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});
	} catch (err) {
		clearTimeout(timer);
		if (err?.name === 'AbortError') {
			throw Object.assign(new Error(`three.ws ${path} timed out after ${HTTP_TIMEOUT_MS}ms`), {
				code: 'timeout',
			});
		}
		throw Object.assign(new Error(`three.ws ${path} request failed: ${err?.message || err}`), {
			code: 'network_error',
		});
	}
	clearTimeout(timer);

	const text = await res.text();
	let data;
	try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

	if (!res.ok) {
		const message = data?.message || data?.error || `three.ws ${path} returned HTTP ${res.status}`;
		throw Object.assign(new Error(message), { code: data?.code ?? 'upstream_error', status: res.status, body: data });
	}
	return data;
}

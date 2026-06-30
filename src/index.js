#!/usr/bin/env node
// @three-ws/agentcore-payments-mcp — Agent Payment Sessions over MCP.
//
// Implements the governance-first payment pattern:
//   "The agent does not hold a wallet. It proposes spend. Governance enforces policy."
//
// Tools:
//   create_payment_session   — fund a session from credits; get a bearer token
//   pay_with_session         — execute x402 payment via session (no private key)
//   check_payment_session    — inspect budget / status / executions
//   list_payment_sessions    — list sessions + aggregate spend stats
//   cancel_payment_session   — cancel + refund un-spent budget
//
// Two credential types:
//   THREE_WS_SESSION         — your account session for management operations
//   PAYMENT_SESSION_TOKEN    — the session bearer token for agent payments
//
// Run standalone:
//   node packages/agentcore-payments-mcp/src/index.js
//
// Wire into Claude Code / Cursor — see README.md.

import { createRequire } from 'node:module';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { def as createSession } from './tools/create-session.js';
import { def as payWithSession } from './tools/pay-with-session.js';
import { def as checkSession } from './tools/check-session.js';
import { def as listSessions } from './tools/list-sessions.js';
import { def as cancelSession } from './tools/cancel-session.js';

const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../package.json');

export const TOOLS = [
	createSession,
	payWithSession,
	checkSession,
	listSessions,
	cancelSession,
];

export function buildServer() {
	const server = new McpServer(
		{
			name: 'agentcore-payments-mcp',
			title: 'three.ws Agent Payments',
			version: PKG_VERSION,
		},
		{
			capabilities: { tools: {} },
			instructions:
				'three.ws Agent Payment Sessions — governance-first x402 micropayments for AI agents. ' +
				'No private key required. Create a session with a budget, give the token to an agent, ' +
				'and the agent pays x402 endpoints via pay_with_session. The platform\'s wallet signs ' +
				'all transactions; spend is bounded by your session budget, URL allowlist, and per-tx ceiling. ' +
				'Management operations (create/list/cancel) require THREE_WS_SESSION. ' +
				'Payment execution requires PAYMENT_SESSION_TOKEN (or pass inline to pay_with_session). ' +
				'Workflow: 1) create_payment_session to get a token → 2) pay_with_session to call paid endpoints → ' +
				'3) check_payment_session to monitor spend → 4) cancel_payment_session to reclaim unused budget.',
		},
	);

	for (const tool of TOOLS) {
		server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
			try {
				const result = await tool.handler(args);
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
				};
			} catch (err) {
				const code = err?.code ?? 'error';
				const status = err?.status ?? null;
				const body = err?.body ?? null;
				const detail = body
					? `\n\nUpstream detail: ${JSON.stringify(body, null, 2)}`
					: '';
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									ok: false,
									error: err?.message ?? 'unknown error',
									code,
									...(status ? { status } : {}),
								},
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}
		});
	}

	return server;
}

// Start the server when run directly
const isMain =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	(process.argv[1].endsWith('index.js') || process.argv[1].endsWith('agentcore-payments-mcp'));

if (isMain) {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

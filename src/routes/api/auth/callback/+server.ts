import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCallback } from '$lib/server/saml';
import { createSession, deleteSession } from '$lib/server/session';
import { upsertUser } from '$lib/server/user';
import { sanitizeReturnPath } from '$lib/server/url';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const formData = await request.formData();
	const rawSAMLResponse = formData.get('SAMLResponse');
	const RelayState = formData.get('RelayState') as string;

	if (!rawSAMLResponse || typeof rawSAMLResponse !== 'string') {
		return new Response('Missing or invalid SAMLResponse', { status: 400 });
	}

	try {
		const profile = await validateCallback({ SAMLResponse: rawSAMLResponse }, url.origin);
		if (!profile) {
			return new Response('Authentication failed', { status: 401 });
		}

		const userId = await upsertUser(profile);
		await deleteSession(cookies);
		await createSession(userId, profile.nameID, cookies, url.protocol === 'https:');

		redirect(302, sanitizeReturnPath(RelayState));
	} catch (err) {
		if (isRedirect(err)) throw err;
		console.error('SAML validation error:', err);
		return new Response('Authentication failed', { status: 401 });
	}
};

import { isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCallback } from '$lib/server/saml';
import { createSession } from '$lib/server/session';
import { upsertUser } from '$lib/server/user';
import { sanitizeReturnPath } from '$lib/server/url';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const formData = await request.formData();
	const SAMLResponse = formData.get('SAMLResponse') as string;
	const RelayState = formData.get('RelayState') as string;

	if (!SAMLResponse) {
		return new Response('Missing SAMLResponse', { status: 400 });
	}

	try {
		const profile = await validateCallback({ SAMLResponse }, url.origin);
		if (!profile) {
			return new Response('Authentication failed', { status: 401 });
		}

		const userId = await upsertUser(profile);
		await createSession(userId, profile.nameID, cookies, url.protocol === 'https:');

		redirect(302, sanitizeReturnPath(RelayState));
	} catch (err) {
		if (isRedirect(err) || isHttpError(err)) throw err;
		console.error('SAML validation error:', err);
		return new Response('Authentication failed', { status: 401 });
	}
};

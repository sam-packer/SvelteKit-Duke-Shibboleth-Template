import { isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCallback } from '$lib/server/saml';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession } from '$lib/server/session';

function sanitizeReturnPath(relayState: string | null): string {
	if (!relayState || !relayState.startsWith('/') || relayState.startsWith('//')) {
		return '/';
	}
	return relayState;
}

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

		// Atomic upsert — avoids race condition with concurrent logins
		const [user] = await db
			.insert(users)
			.values({
				uid: profile.uid,
				eppn: profile.eppn,
				displayName: profile.displayName,
				givenName: profile.givenName || '',
				sn: profile.sn || '',
				mail: profile.mail || '',
				affiliation: profile.affiliation || ''
			})
			.onConflictDoUpdate({
				target: users.uid,
				set: {
					eppn: profile.eppn,
					displayName: profile.displayName,
					givenName: profile.givenName,
					sn: profile.sn,
					mail: profile.mail,
					affiliation: profile.affiliation,
					lastLoginAt: new Date()
				}
			})
			.returning({ id: users.id });

		await createSession(user.id, profile.nameID, cookies, url.protocol === 'https:');

		redirect(302, sanitizeReturnPath(RelayState));
	} catch (err) {
		if (isRedirect(err) || isHttpError(err)) throw err;
		console.error('SAML validation error:', err);
		return new Response('Authentication failed', { status: 401 });
	}
};

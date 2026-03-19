import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCallback } from '$lib/server/saml';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function signSession(data: string, secret: string): string {
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(data);
	return hmac.digest('hex');
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

		// Upsert user record
		const existing = await db.select().from(users).where(eq(users.uid, profile.uid)).limit(1);
		if (existing.length > 0) {
			await db
				.update(users)
				.set({
					eppn: profile.eppn,
					displayName: profile.displayName,
					givenName: profile.givenName,
					sn: profile.sn,
					mail: profile.mail,
					affiliation: profile.affiliation,
					lastLoginAt: new Date()
				})
				.where(eq(users.uid, profile.uid));
		} else {
			await db.insert(users).values({
				uid: profile.uid,
				eppn: profile.eppn,
				displayName: profile.displayName,
				givenName: profile.givenName || '',
				sn: profile.sn || '',
				mail: profile.mail || '',
				affiliation: profile.affiliation || ''
			});
		}

		const sessionData = JSON.stringify({
			uid: profile.uid,
			eppn: profile.eppn,
			displayName: profile.displayName,
			givenName: profile.givenName,
			sn: profile.sn,
			mail: profile.mail,
			affiliation: profile.affiliation,
			nameID: profile.nameID
		});

		const secret = env.SESSION_SECRET || 'fallback-secret';
		const signature = signSession(sessionData, secret);

		const isSecure = url.protocol === 'https:';

		cookies.set('session', sessionData, {
			path: '/',
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			maxAge: 60 * 60 * 8
		});

		cookies.set('session_sig', signature, {
			path: '/',
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			maxAge: 60 * 60 * 8
		});

		const returnTo = RelayState || '/';
		redirect(302, returnTo);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('SAML validation error:', err);
		return new Response('Authentication failed', { status: 401 });
	}
};

import { redirect, type Handle } from '@sveltejs/kit';
import crypto from 'crypto';
import { env } from '$env/dynamic/private';

function verifySession(data: string, signature: string, secret: string): boolean {
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(data);
	const expected = hmac.digest('hex');
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const handle: Handle = async ({ event, resolve }) => {
	const sessionCookie = event.cookies.get('session');
	const sessionSig = event.cookies.get('session_sig');

	if (sessionCookie && sessionSig) {
		try {
			const secret = env.SESSION_SECRET || 'fallback-secret';
			if (verifySession(sessionCookie, sessionSig, secret)) {
				event.locals.user = JSON.parse(sessionCookie);
			} else {
				event.locals.user = null;
				event.cookies.delete('session', { path: '/' });
				event.cookies.delete('session_sig', { path: '/' });
			}
		} catch {
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	// Routes that don't require authentication.
	// Add paths here or invert the logic to protect specific routes instead.
	const publicRoutes = ['/', '/auth', '/api/auth', '/api/health'];
	const isPublicRoute = publicRoutes.some(
		(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	);

	if (!event.locals.user && !isPublicRoute) {
		redirect(302, '/auth/login');
	}

	return resolve(event);
};

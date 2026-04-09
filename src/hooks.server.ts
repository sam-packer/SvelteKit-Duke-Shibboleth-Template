import { redirect, type Handle } from '@sveltejs/kit';
import { getSession, deleteSession, cleanExpiredSessions } from '$lib/server/session';

// Periodically clean expired sessions (every 30 minutes)
const CLEANUP_INTERVAL = 30 * 60 * 1000;
let lastCleanup = 0;

export const handle: Handle = async ({ event, resolve }) => {
	const now = Date.now();
	if (now - lastCleanup > CLEANUP_INTERVAL) {
		lastCleanup = now;
		cleanExpiredSessions().catch((err) => {
			lastCleanup = 0; // retry on next request
			console.error('Session cleanup failed:', err);
		});
	}
	const user = await getSession(event.cookies);

	if (user) {
		event.locals.user = user;
	} else {
		event.locals.user = null;

		// Clean up stale cookies if they exist but session is invalid
		if (event.cookies.get('session_id')) {
			await deleteSession(event.cookies);
		}
	}

	// Routes that don't require authentication.
	const publicRoutes = ['/', '/api/auth', '/api/health'];
	const isPublicRoute = publicRoutes.some(
		(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	);

	if (!event.locals.user && !isPublicRoute) {
		redirect(302, '/api/auth/login');
	}

	return resolve(event);
};

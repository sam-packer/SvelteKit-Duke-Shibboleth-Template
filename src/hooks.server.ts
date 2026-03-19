import { redirect, type Handle } from '@sveltejs/kit';
import { getSession, deleteSession } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
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
	const publicRoutes = ['/', '/auth', '/api/auth', '/api/health'];
	const isPublicRoute = publicRoutes.some(
		(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	);

	if (!event.locals.user && !isPublicRoute) {
		redirect(302, '/auth/login');
	}

	return resolve(event);
};

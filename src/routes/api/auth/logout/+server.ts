import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	cookies.delete('session', { path: '/' });
	cookies.delete('session_sig', { path: '/' });
	redirect(302, '/auth/login');
};

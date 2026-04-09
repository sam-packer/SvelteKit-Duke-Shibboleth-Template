import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ cookies }) => {
	await deleteSession(cookies);
	redirect(302, '/');
};

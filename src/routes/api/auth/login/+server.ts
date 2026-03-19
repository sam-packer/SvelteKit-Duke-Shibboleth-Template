import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLoginUrl } from '$lib/server/saml';

export const GET: RequestHandler = async ({ url }) => {
	const returnTo = url.searchParams.get('returnTo') || '/';
	const origin = url.origin;
	const loginUrl = await getLoginUrl(returnTo, origin);
	redirect(302, loginUrl);
};

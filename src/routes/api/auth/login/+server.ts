import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLoginUrl } from '$lib/server/saml';
import { sanitizeReturnPath } from '$lib/server/url';

export const GET: RequestHandler = async ({ url }) => {
	const returnTo = sanitizeReturnPath(url.searchParams.get('returnTo'));
	const loginUrl = await getLoginUrl(returnTo, url.origin);
	redirect(302, loginUrl);
};

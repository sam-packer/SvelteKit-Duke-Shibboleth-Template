import type { RequestHandler } from './$types';
import { getSpMetadata } from '$lib/server/saml';

export const GET: RequestHandler = async () => {
	const metadata = getSpMetadata();
	return new Response(metadata, {
		headers: { 'Content-Type': 'application/xml' }
	});
};

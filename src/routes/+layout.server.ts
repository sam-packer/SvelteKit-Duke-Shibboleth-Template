import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null };
	// Only expose fields needed by the client — keeps nameID, givenName, sn server-side
	const { uid, eppn, displayName, mail, affiliation } = locals.user;
	return { user: { uid, eppn, displayName, mail, affiliation } };
};

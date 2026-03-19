import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

interface SamlProfile {
	uid: string;
	eppn: string;
	displayName: string;
	givenName: string;
	sn: string;
	mail: string;
	affiliation: string;
}

/**
 * Creates or updates a user from SAML profile attributes.
 * Uses an atomic upsert to avoid race conditions with concurrent logins.
 */
export async function upsertUser(profile: SamlProfile): Promise<string> {
	const [user] = await db
		.insert(users)
		.values({
			uid: profile.uid,
			eppn: profile.eppn,
			displayName: profile.displayName,
			givenName: profile.givenName || '',
			sn: profile.sn || '',
			mail: profile.mail || '',
			affiliation: profile.affiliation || ''
		})
		.onConflictDoUpdate({
			target: users.uid,
			set: {
				eppn: profile.eppn,
				displayName: profile.displayName,
				givenName: profile.givenName || '',
				sn: profile.sn || '',
				mail: profile.mail || '',
				affiliation: profile.affiliation || '',
				lastLoginAt: new Date()
			}
		})
		.returning({ id: users.id });

	return user.id;
}

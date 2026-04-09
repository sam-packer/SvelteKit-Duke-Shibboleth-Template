import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { sign as hmacSign, verify as hmacVerify } from '$lib/server/hmac';
import type { Cookies } from '@sveltejs/kit';

const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function getSecret(): string {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		throw new Error('SESSION_SECRET environment variable is not set');
	}
	return secret;
}

function sign(data: string): string {
	return hmacSign(data, getSecret());
}

function verify(data: string, signature: string): boolean {
	return hmacVerify(data, signature, getSecret());
}

export interface SessionUser {
	uid: string;
	eppn: string;
	displayName: string;
	givenName: string;
	sn: string;
	mail: string;
	affiliation: string;
	nameID: string;
}

export async function createSession(
	userId: string,
	nameID: string,
	cookies: Cookies,
	isSecure: boolean
): Promise<void> {
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

	const [session] = await db
		.insert(sessions)
		.values({ userId, nameID, expiresAt })
		.returning({ id: sessions.id });

	const sessionId = session.id;
	const signature = sign(sessionId);

	const cookieOpts = {
		path: '/',
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax' as const,
		maxAge: SESSION_MAX_AGE
	};

	cookies.set('session_id', sessionId, cookieOpts);
	cookies.set('session_sig', signature, cookieOpts);
}

export async function getSession(cookies: Cookies): Promise<SessionUser | null> {
	const sessionId = cookies.get('session_id');
	const sessionSig = cookies.get('session_sig');

	if (!sessionId || !sessionSig) return null;

	try {
		if (!verify(sessionId, sessionSig)) return null;
	} catch {
		return null;
	}

	const result = await db
		.select({
			uid: users.uid,
			eppn: users.eppn,
			displayName: users.displayName,
			givenName: users.givenName,
			sn: users.sn,
			mail: users.mail,
			affiliation: users.affiliation,
			nameID: sessions.nameID
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
		.limit(1);

	if (result.length === 0) return null;

	const row = result[0];
	return {
		uid: row.uid,
		eppn: row.eppn,
		displayName: row.displayName,
		givenName: row.givenName || '',
		sn: row.sn || '',
		mail: row.mail || '',
		affiliation: row.affiliation || '',
		nameID: row.nameID
	};
}

export async function deleteSession(cookies: Cookies): Promise<void> {
	const sessionId = cookies.get('session_id');
	const sessionSig = cookies.get('session_sig');

	if (sessionId && sessionSig) {
		try {
			if (verify(sessionId, sessionSig)) {
				await db.delete(sessions).where(eq(sessions.id, sessionId));
			}
		} catch {
			// Invalid signature — just clear cookies
		}
	}

	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_sig', { path: '/' });
}

export async function cleanExpiredSessions(): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

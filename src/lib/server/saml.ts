import { SAML } from '@node-saml/node-saml';
import { env } from '$env/dynamic/private';
import { getSpKey, getSpCert, getIdpCerts } from '$lib/server/certs';

const DUKE_IDP_ENTRY_POINT = 'https://shib.oit.duke.edu/idp/profile/SAML2/Redirect/SSO';

const samlCache = new Map<string, SAML>();

function getSaml(origin?: string) {
	const baseUrl = origin || env.ORIGIN || env.SAML_SP_ENTITY_ID;
	const callbackUrl = `${baseUrl}/api/auth/callback`;

	const cached = samlCache.get(callbackUrl);
	if (cached) return cached;

	const spKey = getSpKey();
	const saml = new SAML({
		issuer: env.SAML_SP_ENTITY_ID || '',
		callbackUrl,
		privateKey: spKey,
		decryptionPvk: spKey,
		entryPoint: DUKE_IDP_ENTRY_POINT,
		idpCert: getIdpCerts(),
		signatureAlgorithm: 'sha256',
		digestAlgorithm: 'sha256',
		wantAssertionsSigned: false,
		wantAuthnResponseSigned: true,
		audience: env.SAML_SP_ENTITY_ID || '',
		acceptedClockSkewMs: 5000,
		identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
		forceAuthn: false,
		disableRequestedAuthnContext: true
	});

	samlCache.set(callbackUrl, saml);
	return saml;
}

export function getSpMetadata(): string {
	const saml = getSaml();
	const spCert = getSpCert();
	return saml.generateServiceProviderMetadata(spCert, spCert);
}

export async function getLoginUrl(relayState?: string, origin?: string): Promise<string> {
	const saml = getSaml(origin);
	return saml.getAuthorizeUrlAsync(relayState || '/', undefined, {});
}

export async function validateCallback(
	body: { SAMLResponse: string },
	origin?: string
): Promise<{
	uid: string;
	eppn: string;
	displayName: string;
	givenName: string;
	sn: string;
	mail: string;
	affiliation: string;
	nameID: string;
	nameIDFormat: string;
	sessionIndex: string;
} | null> {
	const saml = getSaml(origin);
	const { profile } = await saml.validatePostResponseAsync(body);
	if (!profile) return null;

	const attrs = profile as Record<string, unknown>;

	// SAML attributes can be strings or arrays. Normalize to string.
	function str(value: unknown): string {
		if (Array.isArray(value)) return value.join(';');
		if (typeof value === 'string') return value;
		return '';
	}

	function attr(...keys: string[]): string {
		for (const key of keys) {
			const val = str(attrs[key]);
			if (val) return val;
		}
		return '';
	}

	const eppn =
		attr('urn:oid:1.3.6.1.4.1.5923.1.1.1.6', 'eduPersonPrincipalName') ||
		profile.nameID ||
		'';
	const uid = attr('urn:oid:0.9.2342.19200300.100.1.1', 'uid') || eppn.split('@')[0] || '';
	const displayName = attr('urn:oid:2.16.840.1.113730.3.1.241', 'displayName');
	const givenName = attr('urn:oid:2.5.4.42', 'givenName');
	const sn = attr('urn:oid:2.5.4.4', 'sn');
	const mail = attr('urn:oid:0.9.2342.19200300.100.1.3', 'mail');
	const affiliation = attr(
		'urn:oid:1.3.6.1.4.1.5923.1.1.1.9',
		'eduPersonScopedAffiliation',
		'urn:oid:1.3.6.1.4.1.5923.1.1.1.1',
		'eduPersonAffiliation'
	);

	return {
		uid,
		eppn,
		displayName,
		givenName,
		sn,
		mail,
		affiliation,
		nameID: profile.nameID || '',
		nameIDFormat: profile.nameIDFormat || '',
		sessionIndex: profile.sessionIndex || ''
	};
}

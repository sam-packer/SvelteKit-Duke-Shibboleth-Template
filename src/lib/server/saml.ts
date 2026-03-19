import { SAML } from '@node-saml/node-saml';
import { env } from '$env/dynamic/private';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DUKE_IDP_ENTRY_POINT = 'https://shib.oit.duke.edu/idp/profile/SAML2/Redirect/SSO';
const DUKE_IDP_ENTITY_ID = 'https://shib.oit.duke.edu/shibboleth-idp';

/**
 * Reads a PEM file from the certs/ directory.
 * Falls back to the given environment variable if the file doesn't exist.
 */
function readCert(filename: string, envFallback?: string): string {
	const filePath = resolve('certs', filename);
	if (existsSync(filePath)) {
		return readFileSync(filePath, 'utf-8').trim();
	}
	return envFallback?.trim() || '';
}

/**
 * Reads the IdP certificate(s). Supports multiple certificates in a single file
 * separated by back-to-back PEM blocks, or multiple files (idp-cert.pem, idp-cert-2.pem, etc.).
 */
function readIdpCerts(): string[] {
	const primary = readCert('idp-cert.pem', env.SAML_IDP_CERT);
	if (!primary) return [];

	// Split on PEM boundaries to support multiple certs in one file
	const certs = primary
		.split(/(?=-----BEGIN CERTIFICATE-----)/)
		.map((c) => c.trim())
		.filter((c) => c.length > 0);

	// Also check for additional numbered cert files
	for (let i = 2; i <= 5; i++) {
		const extra = readCert(`idp-cert-${i}.pem`);
		if (extra) certs.push(extra);
	}

	return certs;
}

function getSaml(origin?: string) {
	const baseUrl = origin || env.ORIGIN || env.SAML_SP_ENTITY_ID;
	const callbackUrl = `${baseUrl}/api/auth/callback`;
	const spKey = readCert('sp-key.pem', env.SAML_SP_PRIVATE_KEY);
	const idpCerts = readIdpCerts();

	return new SAML({
		issuer: env.SAML_SP_ENTITY_ID || '',
		callbackUrl,
		privateKey: spKey,
		decryptionPvk: spKey,
		entryPoint: DUKE_IDP_ENTRY_POINT,
		idpCert: idpCerts,
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
}

export function getSpMetadata(): string {
	const saml = getSaml();
	const spCert = readCert('sp-cert.pem', env.SAML_SP_CERTIFICATE);
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

	const attrs = profile as any;

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

	const eppn = attr(
		'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
		'eduPersonPrincipalName'
	) || profile.nameID || '';
	const uid = attr(
		'urn:oid:0.9.2342.19200300.100.1.1',
		'uid'
	) || eppn.split('@')[0] || '';
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

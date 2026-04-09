import { env } from '$env/dynamic/private';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

type PemType = 'CERTIFICATE' | 'PRIVATE KEY';

// Cache certificate reads — they don't change at runtime
let cachedSpKey: string | undefined;
let cachedSpCert: string | undefined;
let cachedIdpCerts: string[] | undefined;

/**
 * Takes raw PEM or bare base64 and produces a valid PEM string.
 * Handles: missing headers, literal \n in env vars, mangled whitespace, etc.
 */
function normalizePem(raw: string, type: PemType): string {
	const cleaned = raw.replace(/\\n/g, '\n').trim();

	if (cleaned.includes('-----BEGIN ')) {
		return cleaned.replace(
			/(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)/g,
			(_match, header: string, body: string, footer: string) => {
				const base64 = body.replace(/\s+/g, '');
				const lines = base64.match(/.{1,64}/g) || [];
				return `${header}\n${lines.join('\n')}\n${footer}`;
			}
		);
	}

	const base64 = cleaned.replace(/\s+/g, '');
	const lines = base64.match(/.{1,64}/g) || [];
	return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

/**
 * Reads a PEM file from the certs/ directory.
 * Falls back to the given environment variable if the file doesn't exist.
 */
function readCert(filename: string, envFallback?: string, type: PemType = 'CERTIFICATE'): string {
	const filePath = resolve('certs', filename);
	if (existsSync(filePath)) {
		return readFileSync(filePath, 'utf-8').trim();
	}
	if (!envFallback?.trim()) return '';
	return normalizePem(envFallback, type);
}

export function getSpKey(): string {
	if (cachedSpKey === undefined) {
		cachedSpKey = readCert('sp-key.pem', env.SAML_SP_PRIVATE_KEY, 'PRIVATE KEY');
	}
	return cachedSpKey;
}

export function getSpCert(): string {
	if (cachedSpCert === undefined) {
		cachedSpCert = readCert('sp-cert.pem', env.SAML_SP_CERTIFICATE);
	}
	return cachedSpCert;
}

export function getIdpCerts(): string[] {
	if (cachedIdpCerts === undefined) {
		const primary = readCert('idp-cert.pem', env.SAML_IDP_CERT);
		if (!primary) {
			throw new Error(
				'No IdP certificate found. Run "bun run setup" or set SAML_IDP_CERT environment variable.'
			);
		} else {
			const certs = primary
				.split(/(?=-----BEGIN CERTIFICATE-----)/)
				.map((c) => c.trim())
				.filter((c) => c.length > 0);

			for (let i = 2; i <= 5; i++) {
				const extra = readCert(`idp-cert-${i}.pem`);
				if (extra) certs.push(extra);
			}
			cachedIdpCerts = certs;
		}
	}
	return cachedIdpCerts;
}

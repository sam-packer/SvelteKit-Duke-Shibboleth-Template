/**
 * Cross-platform setup script for Duke Shibboleth IdP SvelteKit.
 * Generates SP certificates and downloads Duke's IdP signing certificate.
 *
 * Usage: bun run setup
 */

import { generate } from 'selfsigned';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const CERTS_DIR = resolve('certs');
const SP_KEY = resolve(CERTS_DIR, 'sp-key.pem');
const SP_CERT = resolve(CERTS_DIR, 'sp-cert.pem');
const IDP_CERT = resolve(CERTS_DIR, 'idp-cert.pem');

const DUKE_IDP_METADATA_URL = 'https://shib.oit.duke.edu/duke-metadata-3-signed.xml';

function ensureCertsDir() {
	if (!existsSync(CERTS_DIR)) {
		mkdirSync(CERTS_DIR, { recursive: true });
	}
}

async function generateSpCerts() {
	if (existsSync(SP_KEY) && existsSync(SP_CERT)) {
		console.log('[skip] SP certificates already exist. Delete them to regenerate:');
		console.log(`       ${SP_KEY}`);
		console.log(`       ${SP_CERT}`);
		return;
	}

	console.log('[generate] Creating SP certificate and private key...');

	const attrs = [{ name: 'commonName', value: 'Duke Shibboleth IdP SvelteKit SP' }];
	const pems = await generate(attrs, {
		keySize: 2048,
		days: 3650,
		algorithm: 'sha256'
	});

	writeFileSync(SP_KEY, pems.private);
	writeFileSync(SP_CERT, pems.cert);

	console.log(`[done] ${SP_KEY}`);
	console.log(`[done] ${SP_CERT}`);
}

/**
 * Downloads Duke's IdP metadata XML and extracts the signing certificate(s).
 * The metadata is the authoritative source -- the standalone idp_signing.crt
 * URL can be out of sync with what the IdP actually uses.
 */
async function downloadIdpCert() {
	if (existsSync(IDP_CERT)) {
		console.log('[skip] IdP certificate already exists. Delete to re-download:');
		console.log(`       ${IDP_CERT}`);
		return;
	}

	console.log('[download] Fetching Duke IdP signing certificate from metadata...');

	try {
		const response = await fetch(DUKE_IDP_METADATA_URL);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const xml = await response.text();

		// Extract all X509Certificate values from the metadata.
		// These appear inside <KeyDescriptor use="signing"> elements.
		const certRegex = /<(?:ds:)?X509Certificate>\s*([\s\S]*?)\s*<\/(?:ds:)?X509Certificate>/g;
		const certs: string[] = [];
		let match: RegExpExecArray | null;
		while ((match = certRegex.exec(xml)) !== null) {
			const base64 = match[1].replace(/\s+/g, '');
			certs.push(base64);
		}

		if (certs.length === 0) {
			throw new Error('No X509Certificate found in IdP metadata');
		}

		// Deduplicate (metadata may list the same cert for signing and encryption)
		const uniqueCerts = [...new Set(certs)];

		// Write all certs as PEM blocks in a single file
		const pemContent = uniqueCerts
			.map((cert) => `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`)
			.join('\n');

		writeFileSync(IDP_CERT, pemContent + '\n');
		console.log(`[done] ${IDP_CERT} (${uniqueCerts.length} certificate${uniqueCerts.length > 1 ? 's' : ''})`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[error] Failed to download IdP certificate: ${message}`);
		console.error(`        Download the metadata manually from: ${DUKE_IDP_METADATA_URL}`);
		console.error(`        Extract the X509Certificate and save as: ${IDP_CERT}`);
	}
}

async function main() {
	console.log('Duke Shibboleth IdP SvelteKit - Setup');
	console.log('=========================\n');

	ensureCertsDir();
	await generateSpCerts();

	console.log('');

	await downloadIdpCert();

	console.log('\n--- Next steps ---');
	console.log('1. Register your SP at: https://authentication.oit.duke.edu/manager/register/sp');
	console.log('2. Copy your .env.example to .env and fill in the values');
	console.log('3. Run: bun run db:push');
	console.log('4. Run: bun run dev');
	console.log('');
	console.log('See README.md for detailed registration instructions.');
}

main().catch(console.error);

import crypto from 'crypto';

export function sign(data: string, secret: string): string {
	const hmac = crypto.createHmac('sha256', secret);
	hmac.update(data);
	return hmac.digest('hex');
}

export function verify(data: string, signature: string, secret: string): boolean {
	const expected = sign(data, secret);
	if (signature.length !== expected.length) return false;
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

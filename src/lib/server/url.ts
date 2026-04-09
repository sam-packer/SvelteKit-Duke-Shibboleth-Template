/**
 * Validates a return path to prevent open redirects.
 * Only allows relative paths starting with a single slash.
 */
export function sanitizeReturnPath(value: string | null): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return '/';
	}
	return value;
}

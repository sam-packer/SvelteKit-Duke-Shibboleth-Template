declare global {
	namespace App {
		interface Locals {
			user: {
				uid: string;
				eppn: string;
				displayName: string;
				givenName: string;
				sn: string;
				mail: string;
				affiliation: string;
				nameID: string;
			} | null;
		}
	}
}

export {};

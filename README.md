# Duke Shibboleth IdP SvelteKit Template

A SvelteKit starter template with Duke University SAML SSO authentication built in. Clone it, run the setup script,
register with Duke, and you have a fully authenticated app.

> This template uses SAML vocabulary throughout. At a minimum, you should know that the Duke login page you see when
> signing in is the **Shibboleth IdP** (Duke's Identity Provider), and this application is a **Service Provider (SP)**
> that communicates with it.
>
> In this setup, the **Entity ID** is the SP's unique identifier in Duke. It does not have to be a real or `duke.edu`
> domain, though using your app's domain is good hygiene.
>
> The **ACS URL** is the callback URL where Duke sends the user back after authentication. In this template, the ACS
> URL is `{ORIGIN}/api/auth/callback`.
>
> For a full glossary of SAML terms, see the
> [Vocabulary tab](https://authentication.oit.duke.edu/manager/documentation) on Duke's documentation page.

## What's Included

- **[Bun](https://bun.sh/)** as the package manager. Do not use npm.
- **Duke SAML SSO** via `@node-saml/node-saml` - login, logout, SP metadata endpoint
- **Signed cookie sessions** with HMAC-SHA256 verification
- **PostgreSQL + Drizzle ORM** with `users` and `sessions` tables (auto-populated on first login)
- **Tailwind CSS v4** with [shadcn-svelte](https://www.shadcn-svelte.com/) UI components
- **Node.js adapter** for deployment anywhere (Railway, Fly, VPS, Docker, etc.)
- **Cross-platform** - works on Windows, macOS, and Linux (no bash/openssl required)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/sam-packer/SvelteKit-Duke-Shibboleth-Template
cd SvelteKit-Duke-Shibboleth-Template
bun install
```

### 2. Run the setup script

This command generates your SP certificates that you'll give to Duke, and downloads Duke's IdP signing certificate.

```bash
bun run setup
```

This creates three files in `certs/`:

| File           | What it is                                                | Share with Duke?                                |
|----------------|-----------------------------------------------------------|-------------------------------------------------|
| `sp-key.pem`   | Private key for signing SAML requests                     | **No** - keep secret                            |
| `sp-cert.pem`  | Public certificate for your SP                            | **Yes** - you'll paste this during registration |
| `idp-cert.pem` | Duke's IdP signing certificate (downloaded automatically) | N/A - this is Duke's certificate                |

These files are `.gitignore`'d so they won't be committed.

> **How it works:** Instead of cramming PEM content into environment variables, this template reads certificates
> directly from the `certs/` directory. This is cleaner, easier to manage, and works well with Docker volume mounts and
> deployment secret files. Environment variable fallbacks (`SAML_SP_PRIVATE_KEY`, etc.) are available if you can't use
> files.

### 3. Set up your database

You need a PostgreSQL database. You can use a local instance, Docker, Supabase, Neon, or any PostgreSQL provider.

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and set your DATABASE_URL
# Example: postgresql://postgres:password@localhost:5432/my_application
```

Push the schema to your database:

```bash
bun run db:push
```

### 4. Configure environment variables

Generate a random string for your session string using this command and fill it in to your secret .env file:

```shell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit your `.env` file:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/my_application"
SESSION_SECRET="your_randomly_generated_string"
SAML_SP_ENTITY_ID="https://myapp.example.com"
ORIGIN="http://localhost:5173"
```

### Understanding Entity ID, Origin, and ACS URLs

These values must be consistent with what you register with Duke. Getting them wrong is the most common source of SAML
errors.

| Value               | What it is                                                                                                                                                                                                                       | Example                                                |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|
| `SAML_SP_ENTITY_ID` | A unique identifier for your app in Duke's IdP. Must match your Duke registration exactly. Usually your app's domain for good hygiene, but technically any unique identifier Duke accepts. It does not need to be on `duke.edu`. | `https://myapp.example.com`                            |
| `ORIGIN`            | The URL where your app is currently reachable. Changes between environments. Used to construct the ACS callback URL.                                                                                                             | `http://localhost:5173` or `https://myapp.example.com` |
| ACS URL             | The callback URL where Duke sends the user after login and where auth finishes. Auto-generated as `{ORIGIN}/api/auth/callback`.                                                                                                  | `http://localhost:5173/api/auth/callback`              |

**The Entity ID stays the same across environments**: Duke only supports one Entity ID per SP registration. In
practice, this is just the unique name of your app in Duke. It does not have to be your production domain, though using
your domain is the cleanest convention. You can register **multiple ACS URLs** on the same SP, which is how local
development works. You register both your production ACS and a localhost ACS under the same Entity ID.

For **local development** (`.env`):

```env
SAML_SP_ENTITY_ID="https://myapp.example.com"
ORIGIN="http://localhost:5173"
```

For **production** (`.env`):

```env
SAML_SP_ENTITY_ID="https://myapp.example.com"
ORIGIN="https://myapp.example.com"
```

> Note: `SAML_SP_ENTITY_ID` stays the same in both environments. Only `ORIGIN` changes, which changes the ACS callback
> URL that gets sent in the SAML request. Both ACS URLs must be registered with Duke (see step 5).

### 5. Register your SP with Duke's Identity Provider

Duke provides a self-service portal for SP registration:

**https://authentication.oit.duke.edu/manager/register/sp**

Select **"No, I will provide registration details manually."** and fill in the following fields.

#### Entity ID

Use a unique identifier for your app. Best practice is to use your production domain, but it does not have to be a real
domain. It also does not need to be a `duke.edu` domain. Duke effectively treats this as the unique name for your
application. If you ever change it later, update both your Duke registration and `SAML_SP_ENTITY_ID` so they still
match exactly.

```
https://myapp.example.com
```

This must **exactly match** the `SAML_SP_ENTITY_ID` in your `.env` file.

#### Owners

Your NetID should automatically be selected as the owner, you can add a support group if you choose.

#### Certificate

Open `certs/sp-cert.pem` and paste the certificate content **without** the `-----BEGIN CERTIFICATE-----` and
`-----END CERTIFICATE-----` lines. Just the base64 block in the middle.

#### Relying Party Settings

These control how Duke secures the SAML response it sends back to your app.

- [x] **Encrypt Assertion** - Check this. Duke will encrypt the assertion so user attributes are not visible in
  transit. SPs that don't enable encryption are subject to Duke security scans. The template decrypts assertions
  automatically using your SP private key (`certs/sp-key.pem`).
- [ ] **Sign Assertion** - Leave unchecked. You must choose either Sign Assertion **or** Sign Response, not both.
- [x] **Sign Response** - Check this. Duke will cryptographically sign the entire SAML response (which includes the
  assertion). The template validates this signature using the IdP certificate (`certs/idp-cert.pem`).

The template's SAML configuration (`src/lib/server/saml.ts`) expects a signed response (
`wantAuthnResponseSigned: true`). Do not check the Sign Assertion box in the Relying Party Settings.

#### ACS URLs

ACS means the callback URL where Duke redirects the user after authentication and where your app finishes the auth flow.
You can register **multiple ACS URLs** on the same SP. Add both your production URL and localhost for development.

**ACS 1 (production):**

- **Binding:** `2.0:bindings:HTTP-POST`
- **Default ACS:** checked
- **URL:** `https://myapp.example.com/api/auth/callback`

**ACS 2 (local development):**

- **Binding:** `2.0:bindings:HTTP-POST`
- **Default ACS:** unchecked
- **URL:** `http://localhost:5173/api/auth/callback`

The app sends the correct ACS URL in each SAML request based on the `ORIGIN` environment variable, so Duke knows which
one to use.

#### Attributes

Select the attributes you want Duke to release to your SP. The template is preconfigured to parse all of these:

- `displayName` - Full name (and uses preferred name)
- `eduPersonPrincipalName` - NetID@duke.edu (primary identifier)
- `eduPersonScopedAffiliation` - Relationships to Duke (student, staff, faculty, etc.)
- `uid` - NetID
- `givenName` - First legal name
- `sn` - Last legal name
- `mail` - Duke email address

You can also request additional attributes, however you'll need to modify the database schema to accept and store those
attributes as well. The correct file to do this in is: `src/lib/server/db/schema.ts`.

### 6. Run it

```bash
bun run dev
```

Visit `http://localhost:5173`. You should see the "SvelteKit is running!" page with a button to sign in. Clicking it
will redirect you directly to Duke's Shibboleth IdP, and on success you'll see your name and profile attributes.

## Project Structure

```
├── certs/                                  # SP and IdP certificates (gitignored)
│   ├── sp-key.pem                          # Your SP private key
│   ├── sp-cert.pem                         # Your SP certificate
│   └── idp-cert.pem                        # Duke's IdP certificate
├── scripts/
│   └── setup.js                            # Cross-platform cert generation + IdP cert download
├── src/
│   ├── app.d.ts                            # TypeScript types (App.Locals)
│   ├── app.html                            # HTML shell
│   ├── hooks.server.ts                     # Session verification, route protection & cleanup
│   ├── lib/
│   │   ├── components/ui/                  # shadcn-svelte components
│   │   ├── utils.ts                        # Tailwind utilities
│   │   └── server/
│   │       ├── certs.ts                    # PEM normalization, cert reading & caching
│   │       ├── saml.ts                     # SAML protocol (login URL, validation, metadata)
│   │       ├── session.ts                  # Session lifecycle (create, get, delete, cleanup)
│   │       ├── url.ts                      # URL validation (open redirect protection)
│   │       ├── user.ts                     # User upsert from SAML profile
│   │       └── db/
│   │           ├── index.ts                # Database client (lazy singleton)
│   │           └── schema.ts               # Drizzle schema (users & sessions tables)
│   └── routes/
│       ├── +layout.svelte                  # Root layout
│       ├── +layout.server.ts               # Passes user to all pages
│       ├── +page.svelte                    # Homepage (public, includes login button)
│       └── api/
│           ├── auth/
│           │   ├── login/+server.ts        # Redirects to Duke Shibboleth IdP
│           │   ├── callback/+server.ts     # Handles SAML response
│           │   ├── logout/+server.ts       # Clears session, redirects to homepage
│           │   └── metadata/+server.ts     # SP metadata XML
│           └── health/+server.ts           # Health check
├── drizzle.config.ts                       # Drizzle ORM config
├── svelte.config.js                        # SvelteKit config (CSRF trusted origins)
└── package.json
```

## Protecting Routes

By default, the homepage (`/`), `/api/auth/*`, and `/api/health` are public. Everything else requires authentication.
Unauthenticated requests to protected routes are redirected straight to `/api/auth/login`, which initiates the SAML
flow with Duke's IdP.

> **Design note:** This template does not include a dedicated login page. This is a well-known pattern for
> SSO-integrated applications: don't build an intermediate login page when the IdP *is* your login page.

To change which routes are public, edit `src/hooks.server.ts`:

```typescript
// Option A: Protect everything except specific routes (current default)
const publicRoutes = ['/', '/api/auth', '/api/health'];
const isPublicRoute = publicRoutes.some(
	(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
);

if (!event.locals.user && !isPublicRoute) {
	redirect(302, '/api/auth/login');
}

// Option B: Only protect specific routes
const protectedRoutes = ['/dashboard', '/admin'];
const isProtectedRoute = protectedRoutes.some(
	(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
);

if (!event.locals.user && isProtectedRoute) {
	redirect(302, '/api/auth/login');
}
```

## Accessing the User

The authenticated user is available in all server-side code:

```typescript
// In +page.server.ts or +layout.server.ts
export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	// user.uid, user.eppn, user.displayName, user.mail, etc.
};

// In +server.ts (API routes)
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	return json({ user: locals.user });
};

// In form actions
export const actions: Actions = {
	default: async ({ locals }) => {
		const userId = locals.user?.uid;
	}
};
```

The user object shape (defined as `SessionUser` in `src/lib/server/session.ts`):

```typescript
{
	uid: string;         // NetID (e.g., "abc123")
	eppn: string;        // NetID@duke.edu
	displayName: string; // Full name
	givenName: string;   // First name
	sn: string;          // Last name
	mail: string;        // Email address
	affiliation: string; // eduPersonAffiliation / eduPersonScopedAffiliation
	nameID: string;      // SAML NameID
}
```

## Database

The template includes two tables:

- **`users`** — automatically populated when someone logs in for the first time. Subsequent logins update the profile
  and `last_login_at` timestamp.
- **`sessions`** — stores active sessions with an expiration timestamp. Each session references a user and includes the
  SAML NameID for logout. Expired sessions are automatically cleaned up periodically.

To add your own tables, edit `src/lib/server/db/schema.ts` and run:

```bash
bun run db:push      # Push changes directly (dev)
bun run db:generate  # Generate migration SQL (prod)
bun run db:migrate   # Run generated migrations (prod)
```

For production, use `db:generate` + `db:migrate` instead of `db:push` so you have versioned migration files you can
track in git.

## Deployment

### Build

```bash
bun run build
bun start
```

### Environment variables in production

Set these on your hosting provider. All are required.

| Variable            | Description                                         |
|---------------------|-----------------------------------------------------|
| `DATABASE_URL`      | PostgreSQL connection string                        |
| `SESSION_SECRET`    | Random hex string for signing sessions              |
| `SAML_SP_ENTITY_ID` | Your app's entity ID (must match Duke registration) |
| `ORIGIN`            | Your app's public URL                               |

### Certificates in production

**Option A: File-based (recommended)**
Mount your certificate files to the `certs/` directory. Works with Docker volumes, Kubernetes secrets, etc.

**Option B: Environment variables**
Set `SAML_SP_PRIVATE_KEY`, `SAML_SP_CERTIFICATE`, and `SAML_IDP_CERT` as environment variables containing the full PEM
content. The app falls back to these if the files don't exist.

## Related

- **[duke-identity-tools](https://github.com/sam-packer/duke-identity-tools)** — A TypeScript client for Duke's LDAP identity services. Use it to look up people by NetID, email, or other attributes beyond what SAML provides. Install with `bun add duke-identity-tools`.

## Reference

- **Duke SP Registration:** https://authentication.oit.duke.edu/manager/register/sp
- **Duke IdP Metadata:** https://shib.oit.duke.edu/duke-metadata-3-signed.xml
- **Duke IdP Signing Certificate:** Extracted from the metadata above by `bun run setup`
- **Duke Available Attributes:** Listed on the SP registration page

## Troubleshooting

### "Authentication failed" after Duke Shibboleth IdP redirect

- Verify `certs/idp-cert.pem` is present (run `bun run setup` to re-download)
- Check that `SAML_SP_ENTITY_ID` matches what you registered with Duke exactly
- Check that `ORIGIN` matches your actual URL (including `https://`)

### CSRF errors on SAML callback

- `svelte.config.js` already trusts `https://shib.oit.duke.edu` - make sure this hasn't been removed

### Session not persisting

- Ensure `SESSION_SECRET` is set and consistent across restarts
- If behind a reverse proxy, ensure it forwards the `X-Forwarded-Proto` header so cookies are set with `secure: true`
  correctly

### Certificate errors

- Run `bun run setup` to regenerate certificates
- Make sure the certificate you pasted in Duke's registration portal matches `certs/sp-cert.pem` (without the BEGIN/END
  lines)
- PEM files should start with `-----BEGIN` and end with `-----END`

## License

This template is licensed under MIT.

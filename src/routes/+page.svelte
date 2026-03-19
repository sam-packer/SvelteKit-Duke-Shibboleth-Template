<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { LogIn, LogOut, User, Mail, Shield, PartyPopper, Rocket } from '@lucide/svelte';

	let { data } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
	{#if data.user}
		<div class="mb-8 text-center">
			<PartyPopper class="mx-auto mb-4 h-12 w-12 text-primary" />
			<h1 class="text-4xl font-bold tracking-tight">It's working!</h1>
			<p class="mt-2 text-lg text-muted-foreground">
				You are <span class="font-semibold text-foreground">{data.user.displayName}</span>
			</p>
		</div>

		<Card class="w-full max-w-md">
			<CardHeader>
				<CardTitle>Your Profile</CardTitle>
				<CardDescription>Attributes received from Duke's Identity Provider</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="flex items-center gap-3">
					<User class="h-4 w-4 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">Name</p>
						<p class="text-sm text-muted-foreground">{data.user.displayName}</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<Mail class="h-4 w-4 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">Email</p>
						<p class="text-sm text-muted-foreground">{data.user.mail || data.user.eppn}</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<Shield class="h-4 w-4 text-muted-foreground" />
					<div>
						<p class="text-sm font-medium">NetID</p>
						<p class="text-sm text-muted-foreground">{data.user.uid}</p>
					</div>
				</div>

				{#if data.user.affiliation}
					<div>
						<p class="mb-1 text-sm font-medium">Affiliation</p>
						<div class="flex flex-wrap gap-1">
							{#each Array.isArray(data.user.affiliation) ? data.user.affiliation : data.user.affiliation.split(';') as aff (aff)}
								<Badge variant="secondary">{String(aff).trim()}</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<div class="mt-6 space-y-3 text-center">
			<Button href="/api/auth/logout" variant="outline">
				<LogOut class="mr-2 h-4 w-4" />
				Sign Out
			</Button>
			<p class="text-sm text-muted-foreground">
				The authenticated user is available on every page via <code
					class="rounded bg-muted px-1 py-0.5">locals.user</code
				>.
			</p>
		</div>
	{:else}
		<div class="mb-8 text-center">
			<Rocket class="mx-auto mb-4 h-12 w-12 text-primary" />
			<h1 class="text-4xl font-bold tracking-tight">SvelteKit is running!</h1>
			<p class="mt-2 text-muted-foreground">
				Duke Shibboleth IdP is configured. Click below to try logging in.
			</p>
		</div>

		<Card class="w-full max-w-sm">
			<CardHeader class="text-center">
				<CardTitle class="text-lg">Ready to test?</CardTitle>
				<CardDescription>
					Sign in with your Duke NetID to verify the SAML integration
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button href="/api/auth/login" class="w-full" size="lg">
					<LogIn class="mr-2 h-4 w-4" />
					Sign in with Duke Shibboleth IdP
				</Button>
			</CardContent>
		</Card>
	{/if}
</div>

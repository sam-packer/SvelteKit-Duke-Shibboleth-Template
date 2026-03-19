<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { LogIn } from '@lucide/svelte';
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
	<div class="mb-8 text-center">
		<h1 class="text-4xl font-bold tracking-tight">Duke Shibboleth IdP SvelteKit</h1>
		<p class="mt-2 text-muted-foreground">Authenticate with your Duke NetID to continue</p>
	</div>

	<Card class="w-full max-w-sm">
		<CardHeader class="text-center">
			<CardTitle class="text-lg">Welcome</CardTitle>
			<CardDescription>Sign in with your Duke NetID to get started</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<Button href="/api/auth/login" class="w-full" size="lg">
				<LogIn class="mr-2 h-4 w-4" />
				Sign in with Duke Shibboleth IdP
			</Button>
		</CardContent>
	</Card>
</div>

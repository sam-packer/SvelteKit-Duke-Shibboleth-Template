import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	uid: text('uid').notNull().unique(),
	eppn: text('eppn').notNull(),
	displayName: text('display_name').notNull(),
	givenName: text('given_name'),
	sn: text('sn'),
	mail: text('mail'),
	affiliation: text('affiliation'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	lastLoginAt: timestamp('last_login_at', { withTimezone: true }).defaultNow()
});

export const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	nameID: text('name_id').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

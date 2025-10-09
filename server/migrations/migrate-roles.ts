/**
 * Migration script: Convert users.role (string) to users.roles (JSON array)
 * 
 * This script migrates the users table from a single role column to multiple roles.
 * 
 * Steps:
 * 1. Add new 'roles' column as JSON
 * 2. Copy data from 'role' to 'roles' (converting string to array)
 * 3. Drop old 'role' column
 * 
 * Run with: npm run migrate:roles
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function migrateRoles() {
  try {
    console.log('🔄 Starting migration: role → roles...');

    // Step 1: Add new 'roles' column if it doesn't exist
    console.log('📝 Step 1: Adding roles column...');
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb
    `);
    console.log('✅ Roles column added');

    // Step 2: Fetch all users
    console.log('📝 Step 2: Fetching existing users...');
    const allUsers = await db.execute(sql`
      SELECT id, role FROM users WHERE role IS NOT NULL
    `);
    console.log(`📊 Found ${allUsers.rows.length} users to migrate`);

    // Step 3: Migrate each user's role to roles array
    console.log('📝 Step 3: Migrating roles data...');
    for (const user of allUsers.rows as any[]) {
      const oldRole = user.role;
      const newRoles = [oldRole]; // Convert single role to array

      await db.execute(sql`
        UPDATE users 
        SET roles = ${JSON.stringify(newRoles)}::jsonb 
        WHERE id = ${user.id}
      `);
      
      console.log(`  ✓ Migrated user ${user.id}: "${oldRole}" → [${newRoles.map(r => `"${r}"`).join(', ')}]`);
    }
    console.log('✅ All users migrated');

    // Step 4: Drop old 'role' column
    console.log('📝 Step 4: Dropping old role column...');
    await db.execute(sql`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS role
    `);
    console.log('✅ Old role column dropped');

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('ℹ️  Next steps:');
    console.log('   1. Verify the migration with: SELECT id, username, roles FROM users;');
    console.log('   2. Test the application');
    console.log('   3. Run db:push to sync schema if needed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateRoles()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

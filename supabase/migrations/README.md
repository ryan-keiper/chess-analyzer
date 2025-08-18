# Database Migrations

This folder contains SQL migration scripts for the Chess Analyzer database schema.

## Migration Order

Run these scripts in numerical order in your Supabase SQL Editor:

1. **001_initial_schema.sql** - Creates all initial tables (users, usage_logs, etc.)
2. **002_user_profiles_trigger.sql** - Adds trigger to auto-create user profiles on signup

## How to Apply Migrations

### Development (Local Supabase)
1. Open Supabase Dashboard → SQL Editor
2. Copy/paste each migration file in order
3. Run each script

### Production
1. Open Production Supabase Dashboard → SQL Editor  
2. Run the same scripts in the same order
3. ⚠️ **Always test on development first!**

## Migration Status Tracking

Keep track of which migrations have been applied:

### Development Environment
- [x] 001_initial_schema.sql (Applied: 2025-01-XX)
- [x] 002_user_profiles_trigger.sql (Applied: 2025-01-XX)

### Production Environment  
- [ ] 001_initial_schema.sql
- [ ] 002_user_profiles_trigger.sql

## Creating New Migrations

When making database changes:

1. Create new file: `003_descriptive_name.sql`
2. Test in development first
3. Update this README with the new migration
4. Apply to production when ready

## Rollback Strategy

If a migration fails:
1. Check Supabase logs for specific error
2. Fix the SQL and re-run
3. For complex rollbacks, create a new migration that reverses changes

## Notes

- All migration files are safe to commit to Git (no secrets)
- Migrations should be idempotent when possible (safe to run multiple times)
- Always backup production data before major schema changes
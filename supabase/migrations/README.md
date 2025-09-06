# Database Migrations

This folder contains SQL migration scripts for the Chess Analyzer database schema.

## Migration Order

Run these scripts in numerical order in your Supabase SQL Editor:

1. **001_initial_schema.sql** - Creates initial tables (users, usage_logs, analyses, subscriptions)
2. **002_user_profiles_trigger.sql** - Adds trigger to auto-create user profiles on signup
3. **003_create_chess_openings_table.sql** - Creates chess_openings table for ECO database
4. **004_wikibooks_positions_table.sql** - (Legacy) WikiBooks integration - can skip if using Polyglot only
5. **005_enhance_chess_openings.sql** - Adds polyglot_key and path_hash columns for fast lookups
6. **006_create_openings_prefix.sql** - Creates openings_prefix table for transposition handling
7. **007_remove_wikibooks.sql** - Removes WikiBooks tables and columns (cleanup migration)

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
- [x] 001_initial_schema.sql
- [x] 002_user_profiles_trigger.sql
- [x] 003_create_chess_openings_table.sql
- [x] 004_wikibooks_positions_table.sql
- [x] 005_enhance_chess_openings.sql
- [x] 006_create_openings_prefix.sql
- [x] 007_remove_wikibooks.sql

### Production Environment  
- [ ] 001_initial_schema.sql
- [ ] 002_user_profiles_trigger.sql
- [ ] 003_create_chess_openings_table.sql
- [ ] 004_wikibooks_positions_table.sql (optional - can skip)
- [ ] 005_enhance_chess_openings.sql
- [ ] 006_create_openings_prefix.sql
- [ ] 007_remove_wikibooks.sql (only if 004 was applied)

## Creating New Migrations

When making database changes:

1. Create new file: `008_descriptive_name.sql` (next number in sequence)
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
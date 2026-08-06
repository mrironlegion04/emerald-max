const env = process.env as unknown as Record<string, string | undefined>
env['NODE_ENV'] = 'test'
// PrismaClient is constructed at module load in lib/db.ts and requires a
// resolvable datasource URL even if no query ever runs.
env['DATABASE_URL'] =
  env['DATABASE_URL'] ?? 'postgresql://test:test@localhost:5432/test_db'

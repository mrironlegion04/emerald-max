export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Pre-warm the pool by acquiring real connections
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 15000,
    })

    let retries = 15
    while (retries > 0) {
      try {
        const client = await pool.connect()
        await client.query('SELECT 1')
        client.release()
        console.log('✓ DB ready')
        break
      } catch (e: any) {
        retries--
        console.warn(`DB not ready: ${e.message} — retrying (${retries} left)`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    await pool.end()

    // Now import prisma so its pool initializes AFTER we confirmed DB is up
    await import('./lib/db')
  }
}
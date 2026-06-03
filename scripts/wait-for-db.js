const { Client } = require('pg')

async function waitForDb() {
  const maxRetries = 30
  let retries = 0
  
  while (retries < maxRetries) {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      console.log('✓ DB ready, starting Next.js...')
      process.exit(0)
    } catch (e) {
      retries++
      console.log(`DB not ready (${retries}/${maxRetries}), retrying in 2s...`)
      await client.end().catch(() => {})
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  
  console.error('DB never became ready, exiting')
  process.exit(1)
}

waitForDb()
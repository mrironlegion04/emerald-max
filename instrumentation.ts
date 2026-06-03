// instrumentation.ts  (in your project root, next to app/)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('./lib/db')
    let retries = 10
    while (retries > 0) {
      try {
        await prisma.$queryRaw`SELECT 1`
        console.log('✓ DB connection established')
        break
      } catch (e) {
        retries--
        console.warn(`DB not ready, ${retries} retries left...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }
}
/** EstoquePro — health check público */
import { ok } from '@/server/lib/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok({ sistema: 'EstoquePro', status: 'online', dataHora: new Date().toISOString() })
}

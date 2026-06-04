export type SqliteTableDto = {
  name: string
  rowCount: number
}

export type SqliteTableResetResponse = {
  success: boolean
  message: string
  totalDeleted: number
  resetTables: string[]
}

export const listSqliteTables = async (): Promise<SqliteTableDto[]> => {
  const res = await fetch('/api/sqlite/tables')
  if (!res.ok) throw new Error(`Erreur serveur ${res.status}`)
  return res.json()
}

export const resetSqliteTables = async (tableNames: string[]): Promise<SqliteTableResetResponse> => {
  const res = await fetch('/api/sqlite/tables/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableNames }),
  })
  if (!res.ok) throw new Error(`Erreur serveur ${res.status}`)
  return res.json()
}

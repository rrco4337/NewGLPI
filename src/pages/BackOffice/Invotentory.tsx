import { useComputerList } from '@/hooks/useComputerList'

export const Inventory = () => {
  const { computers, loading, error, refresh } = useComputerList()

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1>Inventaire — Ordinateurs</h1>
        <button onClick={refresh}>🔄 Actualiser</button>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p style={{ color: 'red' }}>Erreur : {error}</p>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Nom</th>
              <th>Asset Tag</th>
              <th>N° de série</th>
            </tr>
          </thead>
          <tbody>
            {computers.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.otherserial || '—'}</td>
                <td>{c.serial || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && computers.length === 0 && !error && (
        <p>Aucun ordinateur trouvé.</p>
      )}
    </div>
  )
}

import { useComputerForm } from '@/hooks/useComputerForm'
import { useGlpiConnection } from '@/hooks/useGlpiConnection'
import { TopBar } from '@/components/TopBar/TopBar'
import { ComputerForm } from '@/components/ComputerForm/ComputerForm'
import { SummaryPanel } from '@/components/SummaryPanel/SummaryPanel'
import { ChecklistPanel } from '@/components/ChecklistPanel/ChecklistPanel'
import { StatusMessage } from '@/components/StatusMessage/StatusMessage'
import '@/App.css'

export const Home = () => {
  const connection = useGlpiConnection()
  const form = useComputerForm()

  const submitDisabled =
    form.submitState === 'loading' || !connection.hasToken || !connection.hasAppToken

  return (
    <div className="app">
      <TopBar
        apiUrl={connection.apiUrl}
        hasToken={connection.hasToken}
        hasAppToken={connection.hasAppToken}
        connectionState={connection.connectionState}
        onTestConnection={connection.testConnection}
      />

     

      <StatusMessage state={connection.connectionState} message={connection.connectionMessage} />

      <main className="layout">
        <ComputerForm
          formData={form.formData}
          submitState={form.submitState}
          submitMessage={form.submitMessage}
          errors={form.errors}
          submitDisabled={submitDisabled}
          hasToken={connection.hasToken}
          hasAppToken={connection.hasAppToken}
          onChange={form.handleChange}
          onSubmit={form.handleSubmit}
        />
        <aside className="side">
          <SummaryPanel formData={form.formData} />
          <ChecklistPanel />
         <button className="btn btn-primary"><a href="/elements">Voir les éléments</a></button> 
        </aside>
      </main>
       
    </div>
  )
}

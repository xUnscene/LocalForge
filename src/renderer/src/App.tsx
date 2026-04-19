import { useEffect } from 'react'
import { JSX } from 'react'
import { useAppStore, Screen } from './store/app.store'
import { Sidebar } from './components/Sidebar'
import { Generate } from './screens/Generate'
import { Library } from './screens/Library'
import { Models } from './screens/Models'
import { Settings } from './screens/Settings'
import { SetupWizard } from './components/SetupWizard'

const SCREENS: Record<Screen, () => JSX.Element> = {
  generate: () => <Generate />,
  library: () => <Library />,
  models: () => <Models />,
  settings: () => <Settings />,
}

export default function App() {
  const { activeScreen, setupComplete, setSetupComplete } = useAppStore()

  useEffect(() => {
    window.localforge.setup.isComplete().then((complete: boolean) => {
      setSetupComplete(complete)
    })
  }, [setSetupComplete])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar />
      {SCREENS[activeScreen]()}
      {setupComplete === false && (
        <SetupWizard onComplete={() => setSetupComplete(true)} />
      )}
    </div>
  )
}

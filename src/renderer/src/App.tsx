import { useAppStore } from './store/app.store'
import { Sidebar } from './components/Sidebar'
import { Generate } from './screens/Generate'
import { Library } from './screens/Library'
import { Models } from './screens/Models'
import { Settings } from './screens/Settings'

const SCREENS = {
  generate: <Generate />,
  library: <Library />,
  models: <Models />,
  settings: <Settings />,
}

export default function App() {
  const { activeScreen } = useAppStore()
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar />
      {SCREENS[activeScreen]}
    </div>
  )
}

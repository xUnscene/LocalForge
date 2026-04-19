import { useAppStore, Screen } from '../store/app.store'

const NAV_ITEMS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'generate', label: 'Generate', icon: '⚡' },
  { screen: 'library',  label: 'Library',  icon: '🖼' },
  { screen: 'models',   label: 'Models',   icon: '📦' },
  { screen: 'settings', label: 'Settings', icon: '⚙' },
]

export function Sidebar() {
  const { activeScreen, navigate } = useAppStore()

  return (
    <aside style={{
      width: 56,
      background: '#1C1C1C',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: 4,
      flexShrink: 0,
    }}>
      <div style={{
        width: 28, height: 28,
        background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))',
        borderRadius: 'var(--radius)',
        marginBottom: 16,
        boxShadow: '0 0 12px var(--color-accent-glow)',
      }} />
      {NAV_ITEMS.map(({ screen, label, icon }) => (
        <button
          key={screen}
          title={label}
          className={activeScreen === screen ? 'active' : ''}
          onClick={() => navigate(screen)}
          style={{
            width: 40, height: 40,
            background: activeScreen === screen ? 'var(--color-surface)' : 'transparent',
            borderRadius: 'var(--radius)',
            fontSize: 18,
            color: activeScreen === screen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: activeScreen === screen ? '0 0 8px var(--color-accent-glow)' : 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>{icon}</span>
        </button>
      ))}
    </aside>
  )
}

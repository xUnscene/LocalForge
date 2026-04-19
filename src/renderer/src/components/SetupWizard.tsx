interface SetupWizardProps {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  return (
    <div data-testid="setup-wizard">
      <button onClick={onComplete}>Complete Setup</button>
    </div>
  )
}

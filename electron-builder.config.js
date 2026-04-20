module.exports = {
  appId: 'com.localforge.app',
  productName: 'LocalForge',
  copyright: 'Copyright © 2025 LocalForge',
  directories: { output: 'dist' },
  files: [
    'out/**',
    '!out/**/*.map',
  ],
  extraResources: [
    { from: 'sidecar/dist/localforge-sidecar.exe', to: 'localforge-sidecar.exe' },
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'LocalForge',
  },
}

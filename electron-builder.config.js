module.exports = {
  appId: 'com.localforge.app',
  productName: 'LocalForge',
  directories: { output: 'dist' },
  win: { target: 'nsis', icon: 'resources/icon.ico' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
}

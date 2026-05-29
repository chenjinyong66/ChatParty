module.exports = {
  appId: 'com.chatallai.app',
  productName: 'ChatParty',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  files: [
    'dist-electron/**/*',
    'dist/**/*',
    '!**/node_modules/**/*',
    '!**/tests/**/*',
    '!**/docs/**/*',
    '!**/examples/**/*',
    '!**/.*',
    'node_modules/@element-plus/icons-vue/**/*',
    'node_modules/element-plus/**/*',
    'node_modules/pinia/**/*',
    'node_modules/vue/**/*',
    'node_modules/vue-router/**/*'
  ],
  extraResources: [],
  extraFiles: [],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      {
        target: 'dmg',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'x64',
          'arm64'
        ]
      }
    ],
    icon: 'build/icon.png',
    gatekeeperAssess: false,
    type: 'distribution',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: false,
    ignore: [
      '**/Electron Framework.framework/Versions/A/Helpers/**',
      '**/Electron Framework.framework/Versions/A/Resources/**',
      '**/*Helper (GPU).app/**',
      '**/*Helper (Renderer).app/**',
      '**/ReactiveObjC.framework/**',
      '**/Squirrel.framework/**',
      '**/Mantle.framework/**'
    ]
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: [
          'x64'
        ]
      }
    ],
    icon: 'build/icon.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  compression: 'maximum',
  removePackageScripts: true,
  asar: {
    smartUnpack: false
  }
}

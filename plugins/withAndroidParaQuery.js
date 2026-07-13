const {withAndroidManifest} = require('expo/config-plugins')

const withParaQuery = config =>
  withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest

    if (!manifest.queries) manifest.queries = [{}]
    const queries = manifest.queries[0]

    queries.intent = queries.intent || []
    const hasParaScheme = queries.intent.some(
      i =>
        i.action?.[0]?.$?.['android:name'] ===
          'android.intent.action.VIEW' &&
        i.data?.some(d => d.$?.['android:scheme'] === 'para'),
    )
    if (!hasParaScheme) {
      queries.intent.push({
        action: [{$: {'android:name': 'android.intent.action.VIEW'}}],
        data: [{$: {'android:scheme': 'para'}}],
      })
    }

    queries.package = queries.package || []
    const hasParaPackage = queries.package.some(
      p => p.$?.['android:name'] === 'com.para.app',
    )
    if (!hasParaPackage) {
      queries.package.push({$: {'android:name': 'com.para.app'}})
    }

    return config
  })

module.exports = withParaQuery

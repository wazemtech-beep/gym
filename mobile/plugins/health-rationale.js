const { withMainActivity } = require('@expo/config-plugins');
module.exports = config => withMainActivity(config, result => {
  if (result.modResults.language !== 'kt') throw new Error('Health privacy routing expects the Expo Kotlin MainActivity.');
  const marker = '// OXGEN fitness privacy rationale';
  if (!result.modResults.contents.includes(marker)) {
    const code = `${marker}\n    if (intent?.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" || intent?.action == "android.intent.action.VIEW_PERMISSION_USAGE") {\n      intent.data = android.net.Uri.parse("oxgengym://privacy")\n    }\n    `;
    result.modResults.contents = result.modResults.contents.replace(/super\.onCreate\((?:null|savedInstanceState)\)/, match => code + match);
    if (!result.modResults.contents.includes('override fun onNewIntent(')) {
      const handler = '\n  override fun onNewIntent(intent: android.content.Intent) {\n    if (intent.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" || intent.action == "android.intent.action.VIEW_PERMISSION_USAGE") {\n      intent.data = android.net.Uri.parse("oxgengym://privacy")\n    }\n    super.onNewIntent(intent)\n  }\n';
      result.modResults.contents = result.modResults.contents.replace(/}\s*$/, handler + '}\n');
    }
  }
  return result;
});

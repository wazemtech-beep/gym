const fs = require('fs');
const path = require('path');
module.exports = ({ config }) => {
  const base = config;
  const androidServices = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  const iosServices = process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist';
  const hasAndroid = fs.existsSync(path.resolve(__dirname, androidServices)), hasIos = fs.existsSync(path.resolve(__dirname, iosServices));
  const plugins = base.plugins.filter(plugin => !['@react-native-firebase/app', '@react-native-firebase/messaging', 'expo-build-properties'].includes(Array.isArray(plugin) ? plugin[0] : plugin));
  plugins.push(['expo-build-properties', { android: { minSdkVersion: 26, usesCleartextTraffic: process.env.EXPO_PUBLIC_API_URL?.startsWith('http://') || false }, ios: { useFrameworks: 'static' } }], 'expo-notifications', './plugins/health-rationale');
  if (hasAndroid || hasIos) plugins.push('@react-native-firebase/app', '@react-native-firebase/messaging');
  return { ...base, plugins, extra: { ...base.extra, firebaseConfiguredAndroid: hasAndroid, firebaseConfiguredIos: hasIos }, android: { ...base.android, ...(hasAndroid ? { googleServicesFile: androidServices } : {}), permissions: ['android.permission.health.READ_STEPS', 'android.permission.health.READ_DISTANCE', 'android.permission.health.READ_ACTIVE_CALORIES_BURNED', 'android.permission.health.READ_EXERCISE', 'android.permission.POST_NOTIFICATIONS'] }, ios: { ...base.ios, ...(hasIos ? { googleServicesFile: iosServices } : {}) } };
};

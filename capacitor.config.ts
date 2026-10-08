import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roadhaven.game',
  appName: '로드헤이븐',
  webDir: 'dist',
  android: {
    backgroundColor: '#173e36',
    allowMixedContent: false,
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;

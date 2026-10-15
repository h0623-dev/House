import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.ROAD_HAVEN_APP_ID || 'com.roadhaven.game',
  appName: process.env.ROAD_HAVEN_APP_LABEL || '로드헤이븐',
  webDir: process.env.ROAD_HAVEN_WEB_DIR || 'dist',
  android: {
    backgroundColor: '#173e36',
    allowMixedContent: false,
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;

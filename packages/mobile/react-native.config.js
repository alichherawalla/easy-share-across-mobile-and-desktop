const path = require('path');

module.exports = {
  dependencies: {
    'react-native-zeroconf': {
      platforms: {
        ios: null, // Disable auto-linking for iOS since we're Android-only
      },
    },
    'react-native-get-random-values': {
      root: path.resolve(__dirname, 'node_modules/react-native-get-random-values'),
    },
  },
};

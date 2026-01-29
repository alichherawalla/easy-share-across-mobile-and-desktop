const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  server: {
    port: 8082,
  },
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Support importing from shared package
    extraNodeModules: {
      '@easyshare/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb");
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../shared")];

module.exports = config;

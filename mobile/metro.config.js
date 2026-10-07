// Expo's default Metro config, plus .glb as an asset type (the 3D passport lab bundles assets/3d/passport.glb).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb");

module.exports = config;

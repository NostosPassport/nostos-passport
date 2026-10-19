module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_IOS_API_KEY?.trim();
  const plugins = [...(config.plugins ?? [])];

  if (key) plugins.push(["react-native-maps", { iosGoogleMapsApiKey: key }]);

  return {
    ...config,
    plugins,
  };
};

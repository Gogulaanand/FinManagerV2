module.exports = function (api) {
  api.cache(true);
  return {
    // jsxImportSource routes JSX through NativeWind so `className` works on RN
    // components; without it every className is silently dropped.
    presets: [
      ['babel-preset-expo', { reanimated: true, jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};

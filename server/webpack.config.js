const path = require('path');
const nodeExternals = require('webpack-node-externals');

function resolve(dir) {
  return path.join(__dirname, '.', dir);
}

module.exports = {
  mode: 'development',
  entry: [
    '@/server.js',
  ],
  target: 'node',
  devtool: 'inline-cheap-module-source-map',
  externals: [nodeExternals()],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: 'dist/',

    // use absolute paths in sourcemaps (important for debugging via IDE)
    devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]?[hash]',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'tests'),
    },
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  module: {
    rules: [
      // {
      //   test: /\.(js)$/,
      //   loader: 'eslint-loader',
      //   enforce: 'pre',
      //   include: [resolve('src'), resolve('test')],
      //   options: {
      //     // eslint-disable-next-line global-require
      //     formatter: require('eslint-friendly-formatter'),
      //     // emitWarning: !config.dev.showEslintErrorsInOverlay
      //   },
      // },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};

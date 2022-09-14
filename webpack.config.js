const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'source-map',
  mode: 'development',
  entry: {
    main: [
      path.resolve(__dirname, './index.ts')
    ]
  },

  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'main.js',
    publicPath: '/'
  },

  resolve: {
    extensions: ['.js', '.ts']
  },
  
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader'
        },
        exclude: /node_modules/
      },
      {
        test: /\.(png|jpg|webp|mp4)$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 15000
          }
        }
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './demo/index.html')
    }),
    new webpack.HotModuleReplacementPlugin()
  ]
};

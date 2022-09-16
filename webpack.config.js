const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

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
      },
      {
        test: /\.(css|less)$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'postcss-loader'
          },
          {
            loader: 'less-loader'
          }
        ]
      },
    ]
  },

  plugins: [
    new MiniCssExtractPlugin({filename: 'main.[hash].css'}),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './index.html')
    }),
    new webpack.HotModuleReplacementPlugin()
  ]
};

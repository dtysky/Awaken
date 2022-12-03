const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env) => {
  const platform = env.plat || 'desktop';

  return {
    devtool: 'source-map',
    mode: 'development',
    stats: {
      warnings:false
    },

    entry: {
      main: [
        path.resolve(__dirname, './src/index.tsx')
      ]
    },
  
    output: {
      path: path.resolve(__dirname, 'platforms', platform, './assets'),
      filename: 'main.[hash].js',
      publicPath: '/'
    },
  
    resolve: {
      extensions: ['.js', '.ts', '.tsx']
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
          test: /\.(css|scss|sass)$/,
          use: [
            {
              loader: MiniCssExtractPlugin.loader
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    ['postcss-preset-env'],
                  ],
                }
              }
            },
            {
              loader: 'sass-loader'
            },
            {
              loader: 'sass-resources-loader',
              options: {
                resources: './src/frontend/styles/awaken.hana-theme.scss'
              }
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
    ],

    devServer: {
      host: '0.0.0.0',
      port: 8888,
      hot: true,
      client: {
        overlay: false,
      },
      proxy: {
        '/dav': {
          target: 'http://127.0.0.1:8889'
        }
      }
    }
  };
};

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const davServer = require('./webdav.server');

function syncVersions() {
  const version = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).version;
  let tmp = JSON.parse(fs.readFileSync('./platforms/desktop/tauri.conf.json', 'utf-8')).package.version;
  tmp.version = version;
  fs.writeFileSync('./platforms/desktop/tauri.conf.json', JSON.stringify(tmp, undefined, 2), 'utf-8');
}

module.exports = (env) => {
  const isProd = !!env.production;

  if (!isProd) {
    davServer.start((s) => {
      console.log('Dav server started on port ' + s.address().port + '.');
    });
  } else {
    syncVersions();
  }

  return {
    devtool: !isProd ? 'source-map' : false,
    mode: isProd ? 'production' : 'development',
    stats: {
      warnings:false
    },

    entry: {
      main: [
        path.resolve(__dirname, './src/index.tsx')
      ]
    },
  
    output: {
      path: path.resolve(__dirname, 'dist'),
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
      new webpack.DefinePlugin({
        'process.env': {
          isProd
        }
      }),
      !isProd && new webpack.HotModuleReplacementPlugin()
    ].filter(item => !!item),

    devServer: {
      host: '0.0.0.0',
      port: 8888,
      hot: true,
      client: {
        overlay: false,
      }
    }
  };
};

'use strict'

const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const isProd = process.env.NODE_ENV === 'production'
const isDev = !isProd

// Rules

const rules = []

rules.push({
  test: /\.css$/,
  use: [
    {loader: 'style-loader'},
    {loader: 'css-loader'},
  ],
})

// Plugins

const plugins = []

plugins.push(new webpack.NamedModulesPlugin())
plugins.push(new HtmlWebpackPlugin({title: 'Ericsson C3 Drop', hash: true}))

if (isDev) {
  plugins.push(new webpack.HotModuleReplacementPlugin())
}

if (isProd) {
  plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      screw_ie8: true,
      warnings: false,
    },
    mangle: {
      screw_ie8: true,
    },
    output: {
      comments: false,
      screw_ie8: true,
    },
  }))
}

// Config

module.exports = {
  devtool: isDev ? 'eval-cheap-module-source-map' : false,
  context: __dirname,
  entry: path.join(__dirname, 'src'),
  devServer: {
    hot: true,
  },
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '',
    filename: 'bundle.js',
  },
  module: {
    rules,
  },
  plugins,
}

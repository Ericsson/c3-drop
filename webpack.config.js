'use strict'

const path = require('path')
const webpack = require('webpack')
const AutoPrefixer = require('autoprefixer')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

const isProd = process.env.NODE_ENV === 'production'
const isDev = !isProd

function getVersion() {
  let version = require('./package').version
  let getCommitHash = require('child_process').spawnSync('git', ['rev-parse', 'HEAD'])
  let commit = getCommitHash.stdout.toString().replace(/[^0-9a-f]/g, '')

  let dirtyCheck = require('child_process').spawnSync('git', ['diff-index', '--quiet', 'HEAD', '--'])
  let isDirty = dirtyCheck.status !== 0

  if (isDirty) {
    commit += '-dirty'
  }
  return {commit, version}
}

// Entry

var entry = path.join(__dirname, 'src')

if (isDev) {
  entry = [
    'react-hot-loader/patch',
    entry,
  ]
}

// Rules

const rules = []

rules.push({
  test: /\.(jpe?g|png|gif|svg|eot|ttf|woff2?)$/,
  use: [
    {loader: 'url-loader', options: {
      limit: 10000,
      name: '[name].[hash:16].[ext]',
    }},
  ],
})

rules.push({
  test: /\.(js)$/,
  include: path.join(__dirname, 'src'),
  use: [
    {loader: 'babel-loader', options: {
      cacheDirectory: true,
    }},
    {loader: 'eslint-loader', options: {
      emitWarning: true,
    }},
  ],
})

const cssProcessors = [
  {loader: 'css-loader', options: {
    modules: true,
  }},
  {loader: 'postcss-loader', options: {
    plugins: [
      AutoPrefixer({
        browsers: ['>1%', 'last 4 versions', 'Firefox ESR', 'not ie < 9'], // From create-ract-app
        cascade: true,
        remove: true,
      }),
    ]
  }},
]

if (isDev) {
  rules.push({
    test: /\.css$/,
    use: [
      {loader: 'style-loader'},
      ...cssProcessors,
    ],
  })
}

if (isProd) {
  rules.push({
    test: /\.css$/,
    use: ExtractTextPlugin.extract(cssProcessors),
  })
}

// Plugins

const plugins = []

plugins.push(new webpack.NamedModulesPlugin())
plugins.push(new HtmlWebpackPlugin({title: 'Ericsson C3 Drop', hash: true}))
plugins.push(new webpack.DefinePlugin({'process.env.VERSION': JSON.stringify(getVersion())}))

if (isDev) {
  plugins.push(new webpack.HotModuleReplacementPlugin())
}

if (isProd) {
  plugins.push(new ExtractTextPlugin('bundle.css'))
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
  entry,
  devServer: {
    hot: true,
  },
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '',
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      components: path.resolve(__dirname, 'src/components/'),
      images: path.resolve(__dirname, 'src/images/'),
      styles: path.resolve(__dirname, 'src/styles/'),
    },
  },
  module: {
    rules,
  },
  plugins,
}

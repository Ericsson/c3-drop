'use strict'


import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'

import 'styles/global.css'

import Hello from 'components/Hello'

const root = document.createElement('div')
document.body.appendChild(root)

const render = Component => {
  let app = (
    <AppContainer>
      <Component/>
    </AppContainer>
  )
  ReactDOM.render(app, root)
}

render(Hello)

if (module.hot) {
  module.hot.accept('components/Hello', () => {
    render(Hello)
  })
}

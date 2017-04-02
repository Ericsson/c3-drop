'use strict'

import './main.css'

import React from 'react'
import ReactDOM from 'react-dom'

import Hello from 'components/Hello'

const root = document.createElement('div')
document.body.appendChild(root)

ReactDOM.render(
  <Hello/>
, root)

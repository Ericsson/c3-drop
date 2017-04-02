
import React, {Component} from 'react'

import './Hello.css'

export default class Hello extends Component {
  constructor(props) {
    super(props)
    this._onTick = this._onTick.bind(this)
    this.state = {
      count: 0,
    }
  }

  componentDidMount() {
    this._intervalId = setInterval(this._onTick, 1000)
    console.log('Hello!')
  }

  componentWillUnmount() {
    clearInterval(this._intervalId)
    console.log('Goodbye!')
  }

  _onTick() {
    this.setState({count: this.state.count + 1})
  }

  render() {
    return <h1 className='Hello'>Hello! {this.state.count}</h1>
  }
}

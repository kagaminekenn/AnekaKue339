import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import Home from './pages/Home'
import Sidebar from './components/Sidebar'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1">
        <Home />
      </div>
    </div>
  )
}

export default App

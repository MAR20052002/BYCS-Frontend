//import { useState } from 'react'
//import reactLogo from './assets/react.svg'
//import viteLogo from '/vite.svg'
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.bundle.min.js"
import './App.css'
import FormularioDinamico from './Components/Swagger/FormularioDinamico'

function App() {
  //const [count, setCount] = useState(0)

  return (
    <>
      <h1 className="container-md border">RRHH Cloud</h1>
      <FormularioDinamico/>
    </>
  )
}

export default App

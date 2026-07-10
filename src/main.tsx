import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ExhibitPage } from './app/ExhibitPage'
import { IndexPage } from './app/IndexPage'
import './styles/global.css'

const router = createBrowserRouter([
  { path: '/', element: <IndexPage /> },
  { path: '/:exhibitId', element: <ExhibitPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

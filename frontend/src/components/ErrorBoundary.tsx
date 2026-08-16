import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-brand flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">{this.state.message}</p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => this.setState({ hasError: false, message: '' })}>Try again</Button>
            <Button variant="outline" onClick={() => (window.location.href = '/')}>
              Go home
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function NotFoundPage() {
  return (
    <div className="container-brand flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">The page you requested does not exist or was moved.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button>Home</Button>
        </Link>
        <Link to="/shop">
          <Button variant="outline">Browse shop</Button>
        </Link>
      </div>
    </div>
  )
}

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-[260px] items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="mt-5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
              Workspace interruption
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left text-xs leading-5 text-slate-600">
              The current screen lost its working state. Retry first, then reload the workspace if the issue keeps repeating.
            </div>

            <h3 className="mt-4 text-xl font-semibold text-slate-900">Something went wrong</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This screen hit an unexpected issue. You can retry now, and if it keeps happening the latest error message is shown below.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latest error</p>
              <p className="mt-2 break-words text-sm text-slate-600">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Reload workspace
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

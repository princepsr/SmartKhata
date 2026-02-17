import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

/**
 * Error Boundary Component
 *
 * Catches React component errors and displays a fallback UI.
 * Prevents the entire app from crashing due to component errors.
 */

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console locally
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Report error to main process via IPC
    if (window.api?.invoke) {
      window.api
        .invoke('app:report-error', {
          error: {
            message: error.message,
            stack: error.stack,
          },
          errorInfo: {
            componentStack: errorInfo.componentStack,
          },
        })
        .catch((err) => {
          console.error('Failed to report error to main process:', err);
        });
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              The application encountered an unexpected error. Don't worry, your data is safe.
            </p>

            {/* Show error message (not stack trace) */}
            {this.state.error && (
              <div className="error-details">
                <p className="error-detail-label">Error:</p>
                <p className="error-detail-text">{this.state.error.message}</p>
              </div>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="btn btn-primary">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn btn-secondary">
                Reload App
              </button>
            </div>

            {/* Developer info (only in development) */}
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="error-stack">
                <summary>Developer Details</summary>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

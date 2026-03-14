import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
          <div className="bg-neutral-800 p-8 rounded-xl shadow-lg border border-red-900/30 max-w-lg w-full text-center space-y-6">
            <h1 className="text-3xl font-bold text-red-500 mb-2">Something went wrong</h1>
            <p className="text-neutral-400">
              An unexpected error has occurred in the application.
            </p>
            {this.state.error && (
              <div className="bg-neutral-950 p-4 rounded text-left overflow-auto max-h-48 text-sm text-red-400">
                <p className="font-mono">{this.state.error.toString()}</p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:ring-4 focus:ring-indigo-500/50 outline-none"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

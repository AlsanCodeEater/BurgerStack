import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in 3D Component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-charcoal/50 border border-flame-orange/20 rounded-xl p-8 text-center">
          <div>
            <div className="w-16 h-16 rounded-full bg-flame-orange/10 flex items-center justify-center mx-auto mb-4 text-flame-orange text-2xl font-black italic">!</div>
            <h3 className="text-xl font-bold tracking-widest uppercase text-warm-cream mb-2">3D Experience Unavailable</h3>
            <p className="text-xs text-warm-cream/50 max-w-sm mx-auto uppercase tracking-wider">
              We couldn't load the interactive 3D model. Don't worry, the burgers taste better in real life anyway.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

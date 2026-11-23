import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div role="alert">
          <h1>Une erreur est survenue</h1>
          <button type="button" onClick={() => { window.location.reload(); }}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

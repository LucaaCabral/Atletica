import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary capturou um erro:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--color-background)] p-6 text-center">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Algo deu errado</h1>
          <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
            Ocorreu um erro inesperado na aplicação. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

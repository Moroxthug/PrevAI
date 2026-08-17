import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, any runtime error anywhere in the tree unmounts React
// entirely and leaves an empty <div id="root">, which is indistinguishable
// from the page never having rendered at all — the worst possible outcome
// for both real visitors and JS-executing crawlers.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error("Unhandled error in component tree", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Qualcosa è andato storto</h1>
          <p className="text-gray-500 max-w-md mb-6">
            Si è verificato un errore imprevisto. Prova a ricaricare la pagina — se il problema
            persiste, contattaci a{" "}
            <a href="mailto:info@prevai.it" className="text-violet-600 font-medium">
              info@prevai.it
            </a>
            .
          </p>
          <a
            href="/"
            className="btn-gradient inline-flex h-11 items-center justify-center px-6 text-sm font-semibold rounded-lg"
          >
            Torna alla home
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

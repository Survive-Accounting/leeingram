import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  title?: string;
  description?: string;
  fullScreen?: boolean;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught runtime error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      title = "This section hit a runtime error",
      description = "The rest of the app is still available. Try reloading this component.",
      fullScreen = false,
    } = this.props;

    return (
      <div
        className={cn(
          "flex w-full items-center justify-center",
          fullScreen ? "min-h-screen bg-background" : "min-h-[280px]"
        )}
      >
        <div className="w-full max-w-xl rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          {this.state.error?.message && (
            <p className="mt-3 text-xs text-muted-foreground">{this.state.error.message}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={this.handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reload Component
            </Button>
            {fullScreen && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

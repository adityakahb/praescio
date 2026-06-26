/**
 * Manages a queue of async requests ensuring only the latest result is applied.
 * Previous in-flight requests are aborted when a new one starts.
 */
export class RequestQueue {
  private nextId = 0;
  private currentId = -1;
  private controller: AbortController | null = null;

  start(): { id: number; signal: AbortSignal } {
    // Abort any previous in-flight request
    this.controller?.abort();
    this.controller = new AbortController();
    this.currentId = ++this.nextId;
    return { id: this.currentId, signal: this.controller.signal };
  }

  isCurrent(id: number): boolean {
    return id === this.currentId;
  }

  cancelAll(): void {
    this.controller?.abort();
    this.controller = null;
    this.currentId = -1;
  }
}

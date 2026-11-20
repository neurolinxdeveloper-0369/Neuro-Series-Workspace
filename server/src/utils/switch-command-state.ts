type Pending = { sequence: number; target: boolean; sent: boolean; timer: ReturnType<typeof setTimeout> };
type Callbacks = {
  send: (channel: number, target: boolean) => Promise<unknown>;
  display: (channel: number, state: boolean) => void;
  fail: (channel: number, reason: string) => void;
};

/** HTTP acceptance is not a hardware acknowledgement. Only observed state confirms a command. */
export class SwitchCommandState {
  private confirmed = new Map<number, boolean>();
  private displayed = new Map<number, boolean>();
  private pending = new Map<number, Pending>();
  private flights = new Set<number>();
  private reports = new Map<number, number>();
  private sequence = 0;
  private disposed = false;
  private callbacks: Callbacks;

  constructor(initial: Record<string, boolean>, callbacks: Callbacks) {
    this.callbacks = callbacks;
    for (const [channel, state] of Object.entries(initial)) {
      this.confirmed.set(Number(channel), state);
      this.displayed.set(Number(channel), state);
    }
  }

  toggle(channel: number) { this.set(channel, !this.displayed.get(channel)); }

  set(channel: number, target: boolean) {
    if (this.disposed) return;
    const previous = this.pending.get(channel);
    if (previous) clearTimeout(previous.timer);
    const sequence = ++this.sequence;
    const timer = setTimeout(() => this.reject(channel, sequence, 'No device confirmation within 3 seconds. Check your internet connection and make sure the device is online.'), 3000);
    this.pending.set(channel, { sequence, target, timer, sent: false });
    this.show(channel, target);
    void this.flush(channel);
  }

  observe(channel: number, state: boolean, reportedAt?: number) {
    if (this.disposed || (reportedAt !== undefined && reportedAt < (this.reports.get(channel) ?? -Infinity))) return;
    if (reportedAt !== undefined) this.reports.set(channel, reportedAt);
    this.confirmed.set(channel, state);
    const pending = this.pending.get(channel);
    if (pending) {
      // A late report for an earlier target must not flicker the latest requested state.
      if (!pending.sent || state !== pending.target) return;
      clearTimeout(pending.timer);
      this.pending.delete(channel);
    }
    this.show(channel, state);
  }

  cancel(reason: string) {
    for (const [channel, pending] of this.pending) this.reject(channel, pending.sequence, reason);
  }

  dispose() {
    this.disposed = true;
    for (const pending of this.pending.values()) clearTimeout(pending.timer);
    this.pending.clear();
  }

  private show(channel: number, state: boolean) {
    this.displayed.set(channel, state);
    this.callbacks.display(channel, state);
  }

  private reject(channel: number, sequence: number, reason: string) {
    const pending = this.pending.get(channel);
    if (this.disposed || pending?.sequence !== sequence) return;
    clearTimeout(pending.timer);
    this.pending.delete(channel);
    this.show(channel, this.confirmed.get(channel) ?? false);
    this.callbacks.fail(channel, reason);
  }

  private async flush(channel: number) {
    if (this.disposed || this.flights.has(channel)) return;
    const pending = this.pending.get(channel);
    if (!pending) return;
    this.flights.add(channel);
    pending.sent = true;
    try { await this.callbacks.send(channel, pending.target); }
    catch { this.reject(channel, pending.sequence, 'Could not send the command. Check your internet connection and make sure the device is online.'); }
    finally {
      this.flights.delete(channel);
      // Serialize requests per channel and coalesce rapid taps to the newest target.
      if (!this.disposed && this.pending.get(channel)?.sequence !== pending.sequence) void this.flush(channel);
    }
  }
}

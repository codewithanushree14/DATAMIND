// timer.js — countdown/stopwatch engine. Calls back into the caller on tick,
// warning threshold, and expiry; does not touch the DOM itself.

export class GameTimer {
  /**
   * @param {'none'|'60'|'90'} mode
   * @param {{onTick:(seconds:number, isWarning:boolean)=>void, onExpire:()=>void, onWarningEnter:()=>void}} callbacks
   */
  constructor(mode, callbacks = {}) {
    this.mode = mode;
    this.callbacks = callbacks;
    this.intervalId = null;
    this.warningFired = false;
    this.reset();
  }

  reset() {
    this.stop();
    this.elapsed = 0;
    this.remaining = this.mode === 'none' ? null : parseInt(this.mode, 10);
    this.warningFired = false;
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => this._tick(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _tick() {
    this.elapsed += 1;
    if (this.mode === 'none') {
      this.callbacks.onTick?.(this.elapsed, false);
      return;
    }
    this.remaining = Math.max(0, this.remaining - 1);
    const isWarning = this.remaining <= 10 && this.remaining > 0;
    if (isWarning && !this.warningFired) {
      this.warningFired = true;
      this.callbacks.onWarningEnter?.();
    }
    this.callbacks.onTick?.(this.remaining, isWarning);
    if (this.remaining <= 0) {
      this.stop();
      this.callbacks.onExpire?.();
    }
  }

  /** Seconds elapsed since game start, regardless of timer mode */
  getElapsedSeconds() {
    return this.elapsed;
  }

  getDisplaySeconds() {
    return this.mode === 'none' ? this.elapsed : this.remaining;
  }
}

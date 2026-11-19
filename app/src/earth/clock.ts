// The shared replay clock. The map and the timeline subscribe to it directly, so a tick does not
// cause a React render. React reads only the whole hour and the play state.

type Listener = () => void;

export class Clock {
  hour = 0;          // position in hours from index 0; can be a fraction
  hours = 1;         // length of the replay
  playing = false;
  speed = 12;        // replay hours per second
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  private emit() { this.listeners.forEach((fn) => fn()); }

  get index() { return Math.max(0, Math.min(this.hours - 1, Math.floor(this.hour))); }

  reset(hours: number, hour = 0) {
    this.pause();
    this.hours = Math.max(1, hours);
    this.hour = hour;
    this.emit();
  }
  set(hour: number) {
    this.hour = Math.max(0, Math.min(this.hours - 1, hour));
    this.emit();
  }
  setSpeed(speed: number) { this.speed = speed; this.emit(); }

  play() {
    if (this.playing) return;
    if (this.hour >= this.hours - 1) this.hour = 0;
    this.playing = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.playing) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.hour += dt * this.speed;
      if (this.hour >= this.hours - 1) { this.hour = this.hours - 1; this.playing = false; }
      this.emit();
      if (this.playing) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.emit();
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }
  toggle() { if (this.playing) this.pause(); else this.play(); }
}

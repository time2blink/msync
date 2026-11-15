import { MS } from './state.js';
// Пружина с начальной скоростью. damping 1 = без перелёта, response = скорость реакции в секундах.

  MS.spring = function ({ from, to, velocity = 0, response = 0.35, damping = 1, onUpdate, onDone }) {
    const k = Math.pow((2 * Math.PI) / response, 2);
    const c = 2 * damping * Math.sqrt(k);
    let x = from, v = velocity, last = performance.now(), raf = 0, stopped = false;

    function frame(t) {
      if (stopped) return;
      let dt = Math.min(0.064, (t - last) / 1000);
      last = t;
      while (dt > 0) {
        const h = Math.min(dt, 0.004);
        v += (-k * (x - to) - c * v) * h;
        x += v * h;
        dt -= h;
      }
      if (Math.abs(x - to) < 0.4 && Math.abs(v) < 8) {
        onUpdate(to);
        if (onDone) onDone();
        return;
      }
      onUpdate(x);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return { stop() { stopped = true; cancelAnimationFrame(raf); } };
  };

  // Сопротивление за границей: чем дальше тянешь, тем меньше элемент следует за пальцем.
  MS.rubber = (over, dim = 200, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));


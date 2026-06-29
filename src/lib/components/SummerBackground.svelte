<script lang="ts">
  // Background canvas that evokes a summer mood (clear sky).
  // Slowly drifting clouds, along with softly blurred yellowish light orbs (bokeh circles), gently float up.

  interface Cloud {
    x: number;
    y: number;
    r: number;
    speed: number;
    alpha: number;
  }
  // A slightly blurred yellowish circle (light orb). Drawn with a radial gradient whose edges fade out softly.
  interface Orb {
    x: number;
    y: number;
    r: number;
    vy: number;
    drift: number;
    phase: number;
    pulse: number;
    alpha: number;
    hue: number;
  }

  // Attachment bound to the canvas: starts the animation when the node is mounted,
  // and releases the loop and listeners via the returned cleanup function when the node is removed.
  function summerScene(el: HTMLCanvasElement) {
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);

    let width = 0;
    let height = 0;
    let dpr = 1;

    let clouds: Cloud[] = [];
    let orbs: Orb[] = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      el.width = Math.floor(width * dpr);
      el.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function build() {
      const area = width * height;
      clouds = Array.from({ length: 6 }, () => ({
        x: rand(0, width),
        y: rand(0, height * 0.55),
        r: rand(90, 200),
        speed: rand(4, 12),
        alpha: rand(0.22, 0.46),
      }));
      const orbCount = Math.round(Math.min(34, Math.max(12, area / 60000)));
      orbs = Array.from({ length: orbCount }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        r: rand(12, 52),
        vy: rand(6, 20),
        drift: rand(10, 36),
        phase: rand(0, Math.PI * 2),
        pulse: rand(0.6, 1.4),
        alpha: rand(0.12, 0.3),
        hue: rand(40, 50),
      }));
    }

    function drawCloud(c: Cloud) {
      const g = ctx!.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawOrb(o: Orb, t: number) {
      const x = o.x + Math.sin(t / 1000 + o.phase) * o.drift;
      // Breathing effect that slowly brightens and dims
      const a = o.alpha * (0.7 + 0.3 * Math.sin((t / 900) * o.pulse + o.phase));
      const g = ctx!.createRadialGradient(x, o.y, 0, x, o.y, o.r);
      g.addColorStop(0, `hsla(${o.hue}, 92%, 72%, ${a})`);
      g.addColorStop(0.55, `hsla(${o.hue}, 88%, 62%, ${a * 0.45})`);
      g.addColorStop(1, `hsla(${o.hue}, 85%, 58%, 0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, o.y, o.r, 0, Math.PI * 2);
      ctx!.fill();
    }

    resize();
    build();

    let raf = 0;
    let last = performance.now();
    const startT = last;

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now - startT;

      ctx!.clearRect(0, 0, width, height);

      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x - c.r > width) {
          c.x = -c.r;
          c.y = rand(0, height * 0.55);
        }
        drawCloud(c);
      }
      // The light orbs gently float up from the bottom, and once they disappear past the top of the screen they reappear from the bottom.
      for (const o of orbs) {
        o.y -= o.vy * dt;
        if (o.y + o.r < 0) {
          o.y = height + o.r;
          o.x = rand(0, width);
        }
        drawOrb(o, t);
      }

      raf = requestAnimationFrame(frame);
    }

    function drawStaticOnce() {
      ctx!.clearRect(0, 0, width, height);
      for (const c of clouds) drawCloud(c);
      for (const o of orbs) drawOrb(o, 0);
    }

    if (reduceMotion) {
      drawStaticOnce();
    } else {
      raf = requestAnimationFrame(frame);
    }

    function handleResize() {
      resize();
      build();
      if (reduceMotion) drawStaticOnce();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }
</script>

<canvas {@attach summerScene} class="summer-bg" aria-hidden="true"></canvas>

<style>
  .summer-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>

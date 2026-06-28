<script lang="ts">
  // 여름 분위기(해바라기/맑은 하늘)를 내는 배경 캔버스.
  // 천천히 흐르는 구름, 살랑이는 해바라기 꽃잎, 반짝이는 빛 입자를 그린다.

  interface Cloud {
    x: number;
    y: number;
    r: number;
    speed: number;
    alpha: number;
  }
  interface Petal {
    x: number;
    y: number;
    size: number;
    vy: number;
    sway: number;
    phase: number;
    rot: number;
    vr: number;
    hue: number;
  }
  interface Spark {
    x: number;
    y: number;
    r: number;
    phase: number;
    speed: number;
  }

  // 캔버스에 부착되는 attachment: 노드가 마운트되면 애니메이션을 시작하고,
  // 노드가 제거되면 반환된 정리 함수로 루프와 리스너를 해제한다.
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
    let petals: Petal[] = [];
    let sparks: Spark[] = [];

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
      const petalCount = Math.round(
        Math.min(42, Math.max(14, area / 42000)),
      );
      petals = Array.from({ length: petalCount }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        size: rand(6, 15),
        vy: rand(12, 32),
        sway: rand(14, 40),
        phase: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.7, 0.7),
        hue: rand(38, 49),
      }));
      sparks = Array.from({ length: 46 }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        r: rand(0.6, 2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.6, 1.6),
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

    function drawPetal(p: Petal, t: number) {
      const x = p.x + Math.sin(t / 1000 + p.phase) * p.sway;
      ctx!.save();
      ctx!.translate(x, p.y);
      ctx!.rotate(p.rot + Math.sin(t / 1400 + p.phase) * 0.6);
      ctx!.fillStyle = `hsla(${p.hue}, 88%, 62%, 0.82)`;
      ctx!.beginPath();
      ctx!.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
      ctx!.fill();
      // 꽃잎 중심에 옅은 코어를 더해 입체감을 준다.
      ctx!.fillStyle = "rgba(255, 244, 200, 0.5)";
      ctx!.beginPath();
      ctx!.ellipse(0, p.size * 0.15, p.size * 0.22, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
    }

    function drawSpark(s: Spark, t: number) {
      const a = 0.35 + 0.35 * Math.sin((t / 600) * s.speed + s.phase);
      if (a <= 0) return;
      ctx!.fillStyle = `rgba(255, 248, 214, ${a})`;
      ctx!.beginPath();
      ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
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
      for (const s of sparks) drawSpark(s, t);
      for (const p of petals) {
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y - p.size > height) {
          p.y = -p.size;
          p.x = rand(0, width);
        }
        drawPetal(p, t);
      }

      raf = requestAnimationFrame(frame);
    }

    function drawStaticOnce() {
      ctx!.clearRect(0, 0, width, height);
      for (const c of clouds) drawCloud(c);
      for (const s of sparks) drawSpark(s, 0);
      for (const p of petals) drawPetal(p, 0);
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

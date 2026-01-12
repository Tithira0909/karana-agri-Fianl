import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ lerp: 0.085 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const nav = document.querySelector("nav");
  const header = document.querySelector(".header");

  const canvas = document.querySelector(".hero-canvas");
  const context = canvas.getContext("2d");

  const panels = Array.from(document.querySelectorAll(".hero-panel"));

  /* ===== Canvas sizing ===== */
  const setCanvasSize = () => {
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(window.innerWidth * pixelRatio);
    canvas.height = Math.floor(window.innerHeight * pixelRatio);

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(pixelRatio, pixelRatio);
  };
  setCanvasSize();

  /* ===== Frames ===== */
  const frameCount = 100;
  const currentFrame = (index) =>
    `/frames/frame_${(index + 1).toString().padStart(4, "0")}.jpg`;

  const images = [];
  const videoFrames = { frame: 0 };
  let imagesToLoad = frameCount;

  const onLoad = () => {
    imagesToLoad--;
    if (!imagesToLoad) {
      render();
      setupScroll();

      // Hide loader
      const loader = document.getElementById("loader");
      if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => loader.remove(), 600);
      }
    }
  };

  for (let i = 0; i < frameCount; i++) {
    const img = new Image();
    img.onload = onLoad;
    img.onerror = onLoad;
    img.src = currentFrame(i);
    images.push(img);
  }

  const render = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    context.clearRect(0, 0, w, h);

    const img = images[videoFrames.frame];
    if (!img || !img.complete || img.naturalWidth <= 0) return;

    const imageAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = w / h;

    let drawWidth, drawHeight, drawX, drawY;

    if (imageAspect > canvasAspect) {
      drawHeight = h;
      drawWidth = drawHeight * imageAspect;
      drawX = (w - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = w;
      drawHeight = drawWidth / imageAspect;
      drawX = 0;
      drawY = (h - drawHeight) / 2;
    }

    context.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  };

  const setupScroll = () => {
    // init panels hidden off-screen
    gsap.set(panels, { opacity: 0, display: "none" });

    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: `+=${window.innerHeight * 12}px`,
      pin: true,
      pinSpacing: true,
      scrub: 1,

      onUpdate: (self) => {
        const progress = self.progress;

        /* 1) Frames playback */
        const framesEnd = 0.98; // use almost full range
        const animP = Math.min(progress / framesEnd, 1);
        videoFrames.frame = Math.round(animP * (frameCount - 1));
        render();

        /* 2) Nav fade early */
        if (progress <= 0.12) gsap.set(nav, { opacity: 1 - progress / 0.12 });
        else gsap.set(nav, { opacity: 0 });

        /* 3) Hero title fades out early */
        const titleStart = 0.05;
        const titleEnd = 0.22;
        const t = gsap.utils.clamp(0, 1, (progress - titleStart) / (titleEnd - titleStart));
        gsap.set(header, { opacity: 1 - t, y: -t * 30, scale: 1 - t * 0.03 });

        /* 4) Panels Horizontal Carousel Logic */
        panels.forEach((panel, i) => {
          const s = parseFloat(panel.dataset.start || "0");
          const e = parseFloat(panel.dataset.end || "0");
          const dt = e - s;

          // Define the lifecycle of horizontal movement
          // Enters from Right (100%) at 's'
          // Exits to Left (-100%) at 'e + dt'
          // Center (0%) at 'e' (roughly)
          // Wait, if Center is at 'e', then it stays on screen too long?
          // Let's align:
          // At 's': x = 100% (Right Edge)
          // At 'e': x = 0% (Center) ?? No.
          // If we want continuous strip:
          // Panel 1 (0.18-0.26): Center at 0.22.
          // Panel 2 (0.26-0.34): Center at 0.30.
          // So center is at (s + e) / 2.
          // Start Map: s -> 100%
          // End Map: e + dt -> -100%
          // Let's verify midpoint: (s + e + dt)/2 = (s + e + e - s)/2 = 2e/2 = e.
          // So Center is at 'e'.
          // But (s+e)/2 is 0.22. 'e' is 0.26.
          // If Center is at 0.26, then Panel 1 is center when Panel 2 enters.
          // That means Panel 1 and Panel 2 collide at Center at 0.26.
          // This is NOT side-by-side.
          // To be side-by-side:
          // At 0.26, Panel 1 must be Left of Center? Or Panel 2 Right of Center?
          // If P1 is Center at 0.22, P2 Center at 0.30.
          // Distance 0.08.
          // Width of card = 100% (or effective width).
          // We want shift of 100% every 0.08.
          // So xPercent should change by 100 every 0.08.
          // Rate = 100 / 0.08 = 1250 units/progress.
          // Formula: xPercent = (CenterPoint - progress) * Rate?
          // CenterPoint for Panel 1 = 0.22.
          // At 0.22, x = 0.
          // At 0.14 (0.22-0.08), x = 100.
          // At 0.30 (0.22+0.08), x = -100.
          // Let's check Panel 2. Center 0.30.
          // At 0.30, x=0.
          // At 0.22, x=100.
          // So at 0.22: Panel 1 is 0. Panel 2 is 100. (Side by side).
          // Perfect!
          // So CenterPoint = (s + e) / 2.
          // Rate = 100 / (e - s).
          // Range of visibility: +/- 100% (or slightly more).

          const centerPoint = (s + e) / 2;
          const duration = e - s; // 0.08 roughly
          const rate = 100 / duration; // ~1250

          // Calculate xPercent
          // Positive if progress < centerPoint (Right)
          // Negative if progress > centerPoint (Left)
          const xPercent = (centerPoint - progress) * rate;

          // Optimization: Hide if significantly off-screen
          // e.g. > 150% or < -150%
          if (xPercent > 180 || xPercent < -180) {
             gsap.set(panel, { display: "none" });
             return;
          }

          gsap.set(panel, {
            xPercent: xPercent,
            y: 0,
            z: 0,
            scale: 1,
            opacity: 1,
            display: "block",
            filter: "none",
            pointerEvents: "auto"
          });
        });
      },
    });

    ScrollTrigger.refresh();
  };

  window.addEventListener("resize", () => {
    setCanvasSize();
    render();
    ScrollTrigger.refresh();
  });
});

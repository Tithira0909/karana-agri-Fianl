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
    // init panels hidden
    gsap.set(panels, { opacity: 0, y: 14, scale: 0.98 });

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

        /* 4) Panels come/go until end (based on data-start/end) */
        panels.forEach((panel, i) => {
          const s = parseFloat(panel.dataset.start || "0");
          const e = parseFloat(panel.dataset.end || "0");

          // New 3D Carousel / Tunnel Logic
          const Z_DEPTH = 2000; // Starting depth
          const FADE_IN_DURATION = 0.25;
          const timeUntilActive = s - progress;

          // Optimization: If too far future or past, hide
          if (timeUntilActive > FADE_IN_DURATION) {
             gsap.set(panel, { opacity: 0, display: "none" });
             return;
          }
          if (progress > e + 0.05) {
             gsap.set(panel, { opacity: 0, display: "none" });
             return;
          }

          let z = 0;
          let opacity = 1;
          let scale = 1;
          let blur = 0;
          let pointerEvents = "none";
          let zIndex = 0;

          if (progress < s) {
             // COMING FROM BACK
             const p = 1 - (timeUntilActive / FADE_IN_DURATION); // 0 to 1
             z = -Z_DEPTH + (p * Z_DEPTH); // -2000 to 0
             opacity = Math.pow(p, 2);
             zIndex = 10 + i;
             scale = 0.8 + 0.2 * p; // Start slightly smaller
          } else if (progress <= e) {
             // ACTIVE
             z = 0;
             opacity = 1;
             scale = 1;
             pointerEvents = "auto";
             zIndex = 100;
          } else {
             // LEAVING (Fly past camera or fade out moving forward)
             const timeSinceEnd = progress - e;
             const p = timeSinceEnd / 0.05; // Quick exit

             // Move towards camera (positive Z)
             z = p * 500;
             opacity = 1 - p;
             scale = 1 + p * 0.5;
             blur = p * 10;
             zIndex = 200; // On top of everything as it leaves
          }

          gsap.set(panel, {
            opacity: opacity,
            z: z,
            scale: scale,
            display: "block",
            pointerEvents: pointerEvents,
            filter: `blur(${blur}px)`,
            zIndex: zIndex,
            y: 0 // Reset any previous Y transform
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

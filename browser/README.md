# Browser demo

From the repository root:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000/browser/**. Stop the server with Ctrl+C.

A local server is needed to load `../hyperflower.frag`; opening the HTML directly as a `file://` URL usually blocks that request. Serve the whole repository, not just this directory.

Requires WebGL 2. No build step, packages, analytics, or CDN assets. Pause, adjust speed, or go fullscreen using the controls. Reduced-motion preferences start the animation paused; you can explicitly resume it.

The demo changes only the shader's version declaration from GLSL ES 3.20 to 3.00 for WebGL 2. This is a visual demo, not an OS screensaver or screen lock.

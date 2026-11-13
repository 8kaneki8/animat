# Animat — Hybrid Character Studio

A standalone browser-based 3D character studio: build general-purpose stylized characters or switch into a dedicated OrBi Creator workspace.

## Current prototype — v0.2

- Interactive Three.js viewport with orbit, pan, and zoom controls
- Live color editing for the shell, accents, and eyes
- Glossy, matte, and metallic material presets
- Eight procedural facial-expression presets
- Idle, Float, Pulse, and Off motion previews
- Part visibility and proportional scaling for head, body, arms, legs, and antenna
- Rename projects, save to browser storage, and import/export `.animat.json` project files
- Responsive editor layout

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Technology

React, TypeScript, Vite, Three.js, React Three Fiber, and Drei.

## Roadmap

1. **Studio foundation:** editor shell, live 3D viewport, project persistence
2. **Character editing:** more detailed mesh controls, rig-aware transforms, part library
3. **OrBi pipeline:** integrate the approved original OrBi model and skin assets
4. **Animation:** timeline, keyframes, reusable clips, and expanded expression rig
5. **Asset workflow:** reusable accessories, asset browser, robust project versioning, and export formats

## Important prototype note

The current character is a procedural placeholder used to develop the editor. It is **not** the final OrBi model and does not yet provide a production character rig, sculpting, or keyframe animation. Those features will be developed as separate milestones.

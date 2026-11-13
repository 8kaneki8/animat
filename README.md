# Animat — Hybrid Character Studio

A standalone browser-based 3D character creation studio. The product direction is a universal character editor with a dedicated, advanced OrBi creator mode.

## First milestone

This repository starts with the studio shell and a procedural 3D mascot prototype:
- Interactive 3D viewport with orbit controls
- Live body, accent, and eye color controls
- Expression and idle-motion presets
- Separate Universal Studio and OrBi Creator workspaces
- Responsive dark studio interface

## Stack

- React + TypeScript + Vite
- Three.js via React Three Fiber
- @react-three/drei for camera and environment controls

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Roadmap

1. Studio shell and interactive procedural prototype
2. Character part system and editable proportions
3. OrBi-specific model and skin pipeline (using approved reference assets)
4. Animation timeline, keyframes, and expression library
5. Asset library, project save/load, and export

> The current prototype is a procedural placeholder model, not the final OrBi asset. The reference character will be integrated once its source model/assets are available.

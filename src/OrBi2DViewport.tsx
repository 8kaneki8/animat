import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

type Camera = { scale: number; x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;

export default function OrBi2DViewport({ children }: { children: ReactNode }) {
  const [camera, setCamera] = useState<Camera>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef(camera);
  const dragRef = useRef<DragState | null>(null);

  const updateCamera = (next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  };

  const zoomAtCenter = (factor: number) => {
    const current = cameraRef.current;
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.scale * factor));
    updateCamera({ ...current, scale });
  };

  const resetCamera = () => updateCamera({ scale: 1, x: 0, y: 0 });

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const current = cameraRef.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left - bounds.width / 2;
    const pointerY = event.clientY - bounds.top - bounds.height / 2;
    const factor = Math.exp(-event.deltaY * 0.0014);
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.scale * factor));
    const ratio = scale / current.scale;
    updateCamera({
      scale,
      x: pointerX - (pointerX - current.x) * ratio,
      y: pointerY - (pointerY - current.y) * ratio,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".viewport-2d-controls")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateCamera({
      ...cameraRef.current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`viewport-2d-camera ${dragging ? "is-panning" : ""}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onDoubleClick={resetCamera}
      aria-label="OrBi 2D canvas. Scroll to move the page, Ctrl+scroll to zoom, drag to pan, double-click to reset."
    >
      <div
        className="viewport-2d-content"
        style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}
      >
        {children}
      </div>
      <div className="viewport-2d-controls" onPointerDown={event => event.stopPropagation()}>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomAtCenter(1.2)}><Plus size={14}/></button>
        <span aria-live="polite">{Math.round(camera.scale * 100)}%</span>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomAtCenter(1 / 1.2)}><Minus size={14}/></button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={resetCamera}><Maximize2 size={13}/></button>
      </div>
    </div>
  );
}

import { d } from "typegpu";
import { mat3 } from "wgpu-matrix";
import type { CharPos } from "../type";
import Manager from "../manager";

export const gpuCandidateStruct = d.struct({
  transform: d.mat3x3f,
  opacity: d.f32,
  color: d.vec3f,
});

export function createGpuCandidate(pos: CharPos) {
  const m = mat3.identity();
  mat3.scale(m, [1 / pos.scale, 1 / pos.scale], m);
  mat3.rotate(m, (-pos.rotation * Math.PI) / 180, m);
  mat3.translate(
    m,
    [-pos.x * Manager.canvasWidth, -pos.y * Manager.canvasHeight],
    m,
  );

  // wgpu-matrix mat3 length can be 9 or 12 depending on version/alignment
  const is12 = m.length === 12;
  const c1 = is12 ? 4 : 3;
  const c2 = is12 ? 8 : 6;

  return {
    transform: d.mat3x3f(
      d.vec3f(m[0], m[1], m[2]),
      d.vec3f(m[c1], m[c1 + 1], m[c1 + 2]),
      d.vec3f(m[c2], m[c2 + 1], m[c2 + 2]),
    ),
    opacity: d.f32(pos.opacity),
    color: d.vec3f(0, 0, 0), // Will be overridden in computeChar if needed
  };
}

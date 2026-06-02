import { d, std } from "typegpu";
import Manager from "./manager";
import type { CharPos, Color } from "./type";

export async function drawDiffDebug(
  // canvas: HTMLCanvasElement,
  color: Color,
  data: CharPos[],
) {
  const root = Manager.root;
  // 1. 일단 debug canvas 텍스처를 불러옴
  const diffTex = Manager.differenceTexture.$usage("sampled").$usage("storage");
  const diffView = diffTex.createView(d.texture2d(d.f32));
  // const sampler = root.createSampler({
  //   magFilter: "nearest",
  //   minFilter: "nearest",
  // });
  // char texture
  if (!Manager.charTexture) return;
  const charTex = Manager.charTexture.$usage("sampled").$usage("storage");
  const charView = charTex.createView(d.texture2d(d.f32));
  // const charSampler = root.createSampler({
  //   magFilter: "nearest",
  //   minFilter: "nearest",
  // });

  // 2. 그런 다음에 위치와 색 데이터를 기반으로 char texture를 debug canvas에 그림
  // 차이를 계산할 array buffer 생성
  const diffBuffer = root.createMutable(d.arrayOf(d.f32, data.length));
  const posStruct = d.struct({
    x: d.f32,
    y: d.f32,
    scale: d.f32,
    opacity: d.f32,
    rotation: d.f32,
  });
  const candidateBuffer = root.createReadonly(
    d.arrayOf(posStruct, data.length),
  );
  candidateBuffer.write(data);
  // 그리고 compute shader를 실행하서 차이를 계산하기

  // 3. 그리고 기존 이미지와의 char이 그려진 이미지와의 차이를 계산함

  // char color를 buffer에 저장
  console.log(color);
  const charColorBuffer = root.createReadonly(d.vec3f, d.vec3f(...color));
  const bgTextureView = Manager.bgView;
  if (!bgTextureView) return;

  // compute shader 생성
  const program = root.createGuardedComputePipeline((xIdx, yIdx) => {
    "use gpu";

    const xy = d.vec2u(xIdx, yIdx);
    // 그런 다음에 기존 이미지와 색상 비교 진행
    const bgTex = std.textureLoad(bgTextureView.$, xy, 0);
    // difference texture를 가져오고, char texture가 이 위에 그려졌을 때의 색상을 계산함
    const diffTex = std.textureLoad(diffView.$, xy, 0);
    const bgTexDimension = std.textureDimensions(bgTextureView.$, 0);
    const charTexDimension = std.textureDimensions(charView.$, 0);

    // read candidate buffer
    // 일단 가장 첫번째 요소만 읽어옴
    const candidate = candidateBuffer.$[0];
    // 픽셀의 해당 좌표가 char texture의 어느 부분에 들어가는지 계산하기

    const scaleMatrix = d.mat3x3f(
      d.vec3f(1 / candidate.scale, 0, 0),
      d.vec3f(0, 1 / candidate.scale, 0),
      d.vec3f(0, 0, 1),
    );
    const rotationRad = (-candidate.rotation * 3.141592) / 180;
    const rotationMatrix = d.mat3x3f(
      d.vec3f(std.cos(rotationRad), std.sin(rotationRad), 0),
      d.vec3f(-std.sin(rotationRad), std.cos(rotationRad), 0),
      d.vec3f(0, 0, 1),
    );
    const transformMatrix = d.mat3x3f(
      d.vec3f(1, 0, 0),
      d.vec3f(0, 1, 0),
      d.vec3f(
        -candidate.x * d.f32(bgTexDimension.x),
        -candidate.y * d.f32(bgTexDimension.y),
        1,
      ),
    );
    const finalMatrix = scaleMatrix.mul(rotationMatrix).mul(transformMatrix);
    const pixelPos = finalMatrix.mul(d.vec3f(d.f32(xy.x), d.f32(xy.y), 1));

    const charMaxX = charTexDimension.x / 2;
    const charMaxY = charTexDimension.y / 2;
    const charMinX = -charMaxX;
    const charMinY = -charMaxY;
    const xCondition = pixelPos.x >= charMinX && pixelPos.x <= charMaxX;
    const yCondition = pixelPos.y >= charMinY && pixelPos.y <= charMaxY;

    // difference texture의 픽셀 색상상
    let diffColor = diffTex.rgb;
    // 만약 char tex의 픽셀이 겹치는 경우, 해당 픽셀의 값을 diffColor위에 덧그림
    if (xCondition && yCondition) {
      const charX = d.u32(pixelPos.x - charMinX);
      const charY = d.u32(pixelPos.y - charMinY);
      const charXy = d.vec2u(charX, charY);
      const charTex = std.textureLoad(charView.$, charXy, 0);
      const charAlpha = charTex.a * candidate.opacity;
      // char color buffer를 가져옴
      const charColor = charColorBuffer.$;
      diffColor = std.mix(diffColor, charColor, charAlpha);
    }

    const dist = std.distance(bgTex.rgb, diffColor);
    // 거리를 0~1 사이의 값으로 변환
    const t = dist / 1.732;
    // 해당 값을 buffer에 저장
    // 저장할때 texture dimension값으로 나눠 주는게 계산에 편하려나?
    // 아니면 나중에 빼는게 좋으려나? 일단은 texture dimension값으로 나눠줌
    const pixelCount = bgTexDimension.x * bgTexDimension.y;
    diffBuffer.$[0] = d.f32(t / pixelCount); // 일단은 임시로 0번째 위치에 저장
    // 나중에 정수로 바꾸고 atomic add 하기
    // std.atomicAdd(diffBuffer.$[0], d.f32(t / pixelCount));
  });

  program.dispatchThreads(Manager.canvasWidth, Manager.canvasHeight);

  const diff = await diffBuffer.read();
  console.log("diff: ", diff[0]);
  return diff;
}

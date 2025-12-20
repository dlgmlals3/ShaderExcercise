'use strict';

function main() {
  console.log('main Start..');

  // Inject shader code into DOM
  injectShaders();

  const canvas = document.querySelector('#canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return;

  const ext = gl.getExtension('WEBGL_depth_texture');
  if (!ext) return alert('need WEBGL_depth_texture');

  // Setup GLSL programs
  const textureProgramInfo = webglUtils.createProgramInfo(gl, ['vertex-shader-3d', 'fragment-shader-3d']);
  const colorProgramInfo   = webglUtils.createProgramInfo(gl, ['color-vertex-shader', 'color-fragment-shader']);

  // Create geometries
  const planeBufferInfo  = primitives.createPlaneBufferInfo(gl, 20, 20, 1, 1);

  const cubeLinesBufferInfo = webglUtils.createBufferInfoFromArrays(gl, {
    position: [
      -1, -1, -1,  1, -1, -1, -1,  1, -1,  1,  1, -1,
      -1, -1,  1,  1, -1,  1, -1,  1,  1,  1,  1,  1,
    ],
    indices: [
      0, 1, 1, 3, 3, 2, 2, 0,
      4, 5, 5, 7, 7, 6, 6, 4,
      0, 4, 1, 5, 3, 7, 2, 6,
    ],
  });

  // Checkerboard texture (fallback)
  const checkerboardTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, checkerboardTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 8, 8, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE,
    new Uint8Array([
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
      0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
    ])
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // 1x1 white texture (fallback when no baseColorTexture)
  function create1x1TextureRGBA(gl, r, g, b, a) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([r, g, b, a]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const whiteTexture = create1x1TextureRGBA(gl, 255, 255, 255, 255);

  function degToRad(d) { return d * Math.PI / 180; }

  const settings = {
    posX: 4.0,
    posY: 4.8,
    posZ: 8.48,
    targetX: 3.5,
    targetY: 0,
    targetZ: 3.5,
    projWidth: 10,
    projHeight: 10,
    perspective: false,
    fieldOfView: 120,
    bias: 0.04,
    frustumDebug: false,
    lightNear: 0.5,
    lightFar: 50,
    shadowSoftness: 1.0,
    shadowMapSize: 4096,
  };

  // Initialize shadow system (after settings)
  const shadowSystem = new ShadowSystem(gl, settings.shadowMapSize);

  // Camera control state
  let cameraDistance = 20;
  let cameraRotationX = 0;
  let cameraRotationY = 0.5;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // UI setup (requires #ui)
  webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
    { type: 'slider', key: 'posX', min: -10, max: 10, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'posY', min: 1, max: 20, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'posZ', min: 1, max: 20, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'targetX', min: -10, max: 10, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'targetY', min: 0, max: 20, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'targetZ', min: -10, max: 20, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'projWidth', min: 0, max: 100, change: render, precision: 2, step: 0.001 },
    { type: 'slider', key: 'projHeight', min: 0, max: 100, change: render, precision: 2, step: 0.001 },
    { type: 'checkbox', key: 'perspective', change: render },
    { type: 'slider', key: 'fieldOfView', min: 1, max: 179, change: render },
    { type: 'slider', key: 'lightNear', min: 0.1, max: 10, change: render, precision: 2, step: 0.01 },
    { type: 'slider', key: 'lightFar', min: 1, max: 100, change: render, precision: 2, step: 0.1 },
    { type: 'slider', key: 'bias', min: 0.0, max: 0.1, change: render, precision: 4, step: 0.001 },
    { type: 'checkbox', key: 'frustumDebug', change: render },
  ]);

  const fieldOfViewRadians = degToRad(60);

  const planeUniforms = {
    u_colorMult: [0.5, 0.5, 1, 1],
    u_color: [1, 0, 0, 1],
    u_texture: checkerboardTexture,
    u_world: m4.translation(0, 0, 0),
  };

  // Initialize GLTF loader
  const gltfLoader = new GLTFLoader(gl);
  let gltfModel = null; // { primitives, scale, offset }

  // File UI
  const fileInput = document.getElementById('gltfFile');
  const modelStatus = document.getElementById('modelStatus');

  fileInput.addEventListener('click', () => console.log('[GLTF] input clicked'));

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { 
      modelStatus.textContent = '선택 취소'; 
      return; 
    }

    try {
      modelStatus.textContent = '로딩중: ' + file.name;

      const { gltf, buffers } = await gltfLoader.loadFile(file);
      gltfModel = await gltfLoader.parse(gltf, buffers);

      modelStatus.textContent = '로딩 완료: ' + file.name;
      render();
    } catch (err) {
      console.error(err);
      modelStatus.textContent = '로딩 실패: ' + err.message;
    }
  });

  // Mouse controls for camera
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    cameraRotationX += deltaX * 0.01;
    cameraRotationY += deltaY * 0.01;

    // Clamp vertical rotation
    cameraRotationY = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraRotationY));

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    render();
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  // Wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraDistance += e.deltaY * 0.01;
    cameraDistance = Math.max(5, Math.min(100, cameraDistance));
    render();
  });

  // Auto-load default model
  async function loadDefaultModel() {
    const defaultPath = './model/DamagedHelmet.glb';
    
    try {
      modelStatus.textContent = '기본 모델 로딩 중...';
      
      const response = await fetch(defaultPath);
      if (!response.ok) {
        throw new Error('기본 모델을 찾을 수 없습니다. 파일을 직접 선택해주세요.');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const file = new File([arrayBuffer], 'DamagedHelmet.glb');
      
      const { gltf, buffers } = await gltfLoader.loadFile(file);
      gltfModel = await gltfLoader.parse(gltf, buffers);
      
      modelStatus.textContent = '기본 모델 로딩 완료';
      render();
    } catch (err) {
      console.error('기본 모델 로딩 실패:', err);
      modelStatus.textContent = '파일을 선택해주세요';
    }
  }

  // Load default model on start
  loadDefaultModel();

  // =========================
  // draw + render
  // =========================
  function drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, programInfo) {
    const viewMatrix = m4.inverse(cameraMatrix);

    gl.useProgram(programInfo.program);

    webglUtils.setUniforms(programInfo, {
      u_view: viewMatrix,
      u_projection: projectionMatrix,
    });

    // for main program (ignored by depth program if uniforms not present)
    webglUtils.setUniforms(programInfo, {
      u_bias: settings.bias,
      u_textureMatrix: textureMatrix,
      u_projectedTexture: shadowSystem.getDepthTexture(),
      u_reverseLightDirection: lightWorldMatrix.slice(8, 11),
      u_shadowMapSize: shadowSystem.getTextureSize(),
    });

    // Plane
    webglUtils.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
    webglUtils.setUniforms(programInfo, planeUniforms);
    webglUtils.drawBufferInfo(gl, planeBufferInfo);

    // GLTF Model
    if (gltfModel && gltfModel.primitives.length) {
      let world = m4.identity();
      world = m4.translate(world, gltfModel.offset[0], gltfModel.offset[1], gltfModel.offset[2]);
      world = m4.scale(world, gltfModel.scale, gltfModel.scale, gltfModel.scale);
      world = m4.translate(world, 0, 0.01, 0);

      for (const p of gltfModel.primitives) {
        webglUtils.setBuffersAndAttributes(gl, programInfo, p.bufferInfo);

        webglUtils.setUniforms(programInfo, {
          u_colorMult: [1, 1, 1, 1],
          u_texture: (p.texture || whiteTexture),
          u_world: world,
          u_color: [1, 1, 1, 1],
        });

        webglUtils.drawBufferInfo(gl, p.bufferInfo);
      }
    }
  }

  function render() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    const lightWorldMatrix = m4.lookAt(
      [settings.posX, settings.posY, settings.posZ],
      [settings.targetX, settings.targetY, settings.targetZ],
      [0, 1, 0]
    );

    const lightProjectionMatrix = settings.perspective
      ? m4.perspective(degToRad(settings.fieldOfView), settings.projWidth / settings.projHeight, settings.lightNear, settings.lightFar)
      : m4.orthographic(
          -settings.projWidth / 2, settings.projWidth / 2,
          -settings.projHeight / 2, settings.projHeight / 2,
          settings.lightNear, settings.lightFar
        );

    // Pass 1: Shadow map
    shadowSystem.beginShadowPass();
    drawScene(lightProjectionMatrix, lightWorldMatrix, m4.identity(), lightWorldMatrix, colorProgramInfo);

    // Pass 2: Main render
    shadowSystem.endShadowPass(gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const textureMatrix = shadowSystem.createTextureMatrix(lightProjectionMatrix, lightWorldMatrix);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);
    
    // Calculate camera position from rotation and distance
    const cameraX = Math.sin(cameraRotationX) * Math.cos(cameraRotationY) * cameraDistance;
    const cameraY = Math.sin(cameraRotationY) * cameraDistance;
    const cameraZ = Math.cos(cameraRotationX) * Math.cos(cameraRotationY) * cameraDistance;
    const cameraPosition = [cameraX, cameraY, cameraZ];
    const cameraMatrix = m4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0]);

    drawScene(projectionMatrix, cameraMatrix, textureMatrix, lightWorldMatrix, textureProgramInfo);

    // Frustum debug (optional)
    if (settings.frustumDebug) {
      gl.useProgram(colorProgramInfo.program);
      webglUtils.setBuffersAndAttributes(gl, colorProgramInfo, cubeLinesBufferInfo);

      const mat = m4.multiply(lightWorldMatrix, m4.inverse(lightProjectionMatrix));
      const viewMatrix = m4.inverse(cameraMatrix);

      webglUtils.setUniforms(colorProgramInfo, {
        u_color: [1, 1, 1, 1],
        u_view: viewMatrix,
        u_projection: projectionMatrix,
        u_world: mat,
      });

      webglUtils.drawBufferInfo(gl, cubeLinesBufferInfo, gl.LINES);
    }
  }

  render();
}

// Wait for all scripts to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
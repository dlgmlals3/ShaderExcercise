// Shader definitions (global scope)

const vertexShader3D = `
attribute vec4 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_textureMatrix;
uniform vec3 u_viewWorldPosition;

varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord;
varying vec3 v_normal;
varying vec3 v_surfaceToView;

void main() {
  vec4 worldPosition = u_world * a_position;
  gl_Position = u_projection * u_view * worldPosition;
  v_texcoord = a_texcoord;
  v_normal = mat3(u_world) * a_normal;
  v_projectedTexcoord = u_textureMatrix * worldPosition;
  v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
}
`;

const fragmentShader3D = `
precision mediump float;

varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord;
varying vec3 v_normal;
varying vec3 v_surfaceToView;

uniform vec4 u_colorMult;
uniform sampler2D u_texture;
uniform sampler2D u_projectedTexture;
uniform float u_bias;
uniform vec3 u_reverseLightDirection;
uniform float u_shadowMapSize;

// ---- Transmission (KHR_materials_transmission BTDF-style) ----
uniform float u_transmissionFactor;
uniform sampler2D u_transmissionTexture; // (R channel 사용)
uniform sampler2D u_sceneColor;          // opaque-only scene color
uniform vec2 u_resolution;
uniform float u_ior;
uniform float u_roughness;

float pcssShadow(vec3 projectedTexcoord, float currentDepth) {
    vec2 texelSize = vec2(1.0 / u_shadowMapSize);

    float blockerDepthSum = 0.0;
    float blockerCount = 0.0;
    const float searchWidth = 5.0;

    for (float x = -searchWidth; x <= searchWidth; x++) {
        for (float y = -searchWidth; y <= searchWidth; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float shadowMapDepth = texture2D(u_projectedTexture, projectedTexcoord.xy + offset).r;

            if (shadowMapDepth < currentDepth) {
                blockerDepthSum += shadowMapDepth;
                blockerCount += 1.0;
            }
        }
    }

    if (blockerCount < 1.0) {
        return 1.0;
    }

    float avgBlockerDepth = blockerDepthSum / blockerCount;

    float lightSize = 2.0;
    float penumbra = (currentDepth - avgBlockerDepth) / avgBlockerDepth * lightSize;

    float filterRadius = penumbra * 20.0;
    filterRadius = clamp(filterRadius, 1.0, 8.0);

    float shadow = 0.0;
    float samples = 0.0;

    for (float x = -8.0; x <= 8.0; x++) {
        for (float y = -8.0; y <= 8.0; y++) {
            if (abs(float(x)) <= filterRadius && abs(float(y)) <= filterRadius) {
                vec2 offset = vec2(float(x), float(y)) * texelSize;
                float projectedDepth = texture2D(u_projectedTexture, projectedTexcoord.xy + offset).r;

                shadow += (projectedDepth <= currentDepth) ? 0.0 : 1.0;
                samples += 1.0;
            }
        }
    }
    return shadow / samples;
}

vec3 sampleSceneBlur(vec2 uv, float rough) {
  // roughness 기반 간단 블러(탭 수 고정, 반경만 rough에 비례)
  // WebGL1에서 RT mipmap이 없으니 다중 샘플로 때움
  vec2 texel = 1.0 / u_resolution;
  float r = clamp(rough, 0.0, 1.0);
  float radius = mix(0.0, 10.0, r); // px 단위 느낌

  vec3 c = vec3(0.0);
  float w = 0.0;

  // 9-tap
  vec2 o1 = vec2( 0.0,  0.0);
  vec2 o2 = vec2( 1.0,  0.0);
  vec2 o3 = vec2(-1.0,  0.0);
  vec2 o4 = vec2( 0.0,  1.0);
  vec2 o5 = vec2( 0.0, -1.0);
  vec2 o6 = vec2( 1.0,  1.0);
  vec2 o7 = vec2(-1.0,  1.0);
  vec2 o8 = vec2( 1.0, -1.0);
  vec2 o9 = vec2(-1.0, -1.0);

  vec2 offs[9];
  offs[0]=o1; offs[1]=o2; offs[2]=o3; offs[3]=o4; offs[4]=o5; offs[5]=o6; offs[6]=o7; offs[7]=o8; offs[8]=o9;

  for (int i=0;i<9;i++){
    vec2 duv = offs[i] * texel * radius;
    float ww = (i==0) ? 2.0 : 1.0;
    c += texture2D(u_sceneColor, clamp(uv + duv, 0.0, 1.0)).rgb * ww;
    w += ww;
  }
  return c / w;
}

void main() {
    vec3 normal = normalize(v_normal);
    vec3 surfaceToViewDirection = normalize(v_surfaceToView);

    float light = dot(normal, u_reverseLightDirection);

    vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
    float currentDepth = projectedTexcoord.z - u_bias;

    bool inRange =
        projectedTexcoord.x >= 0.0 &&
        projectedTexcoord.x <= 1.0 &&
        projectedTexcoord.y >= 0.0 &&
        projectedTexcoord.y <= 1.0;

    float shadowLight = inRange ? pcssShadow(projectedTexcoord, currentDepth) : 1.0;

    vec4 texColor = texture2D(u_texture, v_texcoord) * u_colorMult;
    vec3 litColor = texColor.rgb * light * shadowLight;

    // ---- Transmission BTDF-style compositing ----
    // 화면 좌표 UV
    vec2 screenUV = gl_FragCoord.xy / u_resolution;

    // transmissionTexture는 R 채널로 마스크
    float transMask = texture2D(u_transmissionTexture, v_texcoord).r;

    float t = clamp(u_transmissionFactor * transMask, 0.0, 1.0);

    if (t > 0.0001) {
      // Fresnel: 정면에서 transmission 잘 보이고, grazing에서 줄어드는 느낌
      float NdotV = clamp(dot(normal, surfaceToViewDirection), 0.0, 1.0);
      float fresnel = pow(1.0 - NdotV, 5.0);

      // 간단 굴절 오프셋(정확한 두께/IOR 모델은 아니고, BTDF 느낌용)
      // IOR이 클수록 굴절량 증가시키되 과하지 않게 clamp
      float eta = 1.0 / max(u_ior, 1.0001);
      float refrStrength = clamp((1.0 - eta) * 0.15, 0.0, 0.08);

      // normal.xy로 오프셋 (거칠수록 blur로 먹이니 offset은 적당히)
      vec2 refractOffset = normal.xy * refrStrength * (1.0 - NdotV);

      vec2 refrUV = clamp(screenUV + refractOffset, 0.0, 1.0);

      // roughness 기반 blur
      vec3 behind = sampleSceneBlur(refrUV, u_roughness);

      // Fresnel로 transmission 약간 줄이기(가장자리 덜 투과)
      float transmit = t * (1.0 - fresnel);

      // 최종: 배경(behind)과 현재 셰이딩(litColor) 섞기
      // transmit=1이면 거의 배경만 보이게(유리)
      vec3 outColor = mix(litColor, behind, transmit);

      // 알파는 1 유지 (BTDF는 alpha-blend가 아니라 “배경 샘플” 기반)
      gl_FragColor = vec4(outColor, 1.0);
      return;
    }

    gl_FragColor = vec4(litColor, 1.0);
}
`;

const colorVertexShader = `
attribute vec4 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;

void main() {
  gl_Position = u_projection * u_view * u_world * a_position;
}
`;

const colorFragmentShader = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`;

function injectShaders() {
  const shaders = [
    { id: 'vertex-shader-3d', type: 'x-shader/x-vertex', source: vertexShader3D },
    { id: 'fragment-shader-3d', type: 'x-shader/x-fragment', source: fragmentShader3D },
    { id: 'color-vertex-shader', type: 'x-shader/x-vertex', source: colorVertexShader },
    { id: 'color-fragment-shader', type: 'x-shader/x-fragment', source: colorFragmentShader },
  ];

  shaders.forEach(shader => {
    const script = document.createElement('script');
    script.id = shader.id;
    script.type = shader.type;
    script.textContent = shader.source;
    document.body.appendChild(script);
  });
}

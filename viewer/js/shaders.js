// Shader definitions (global scope)

const vertexShader3D = `
attribute vec4 a_position;
attribute vec2 a_texcoord;
attribute vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_textureMatrix;

varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord;
varying vec3 v_normal;

void main() {
  vec4 worldPosition = u_world * a_position;
  gl_Position = u_projection * u_view * worldPosition;
  v_texcoord = a_texcoord;
  v_normal = mat3(u_world) * a_normal;
  v_projectedTexcoord = u_textureMatrix * worldPosition;
}
`;

const fragmentShader3D = `
precision mediump float;

varying vec2 v_texcoord;
varying vec4 v_projectedTexcoord;
varying vec3 v_normal;

uniform vec4 u_colorMult;
uniform sampler2D u_texture;
uniform sampler2D u_projectedTexture;
uniform float u_bias;
uniform vec3 u_reverseLightDirection;
uniform float u_shadowMapSize;

float hardShadow(vec3 projectedTexcoord, float currentDepth) {
    float projectedDepth = texture2D(u_projectedTexture, projectedTexcoord.xy).r;
    return (projectedDepth <= currentDepth) ? 0.0 : 1.0;            
}

float pcssShadow(vec3 projectedTexcoord, float currentDepth) {
    // Step 1: Blocker Search
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
    
    // Step 2: Penumbra Size
    float lightSize = 2.0;
    float penumbra = (currentDepth - avgBlockerDepth) / avgBlockerDepth * lightSize;
    
    float filterRadius = penumbra * 20.0;
    filterRadius = clamp(filterRadius, 1.0, 8.0);
    
    // Step 3: PCF with variable kernel
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

float pcfShadow(vec3 projectedTexcoord, float currentDepth) {
    vec2 texelSize = vec2(1.0 / u_shadowMapSize);
    
    float shadow = 0.0;
    
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float projectedDepth = texture2D(u_projectedTexture, projectedTexcoord.xy + offset).r;
            
            shadow += (projectedDepth <= currentDepth) ? 0.0 : 1.0;
        }
    }
    
    return shadow / 9.0;
}

void main() {
    vec3 normal = normalize(v_normal);
    float light = dot(normal, u_reverseLightDirection);
    
    vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
    float currentDepth = projectedTexcoord.z - u_bias;

    bool inRange =
        projectedTexcoord.x >= 0.0 &&
        projectedTexcoord.x <= 1.0 &&
        projectedTexcoord.y >= 0.0 &&
        projectedTexcoord.y <= 1.0;

    float shadowLight;
    if (inRange) {
        shadowLight = pcssShadow(projectedTexcoord, currentDepth);
    } else {
        shadowLight = 1.0;
    }
    
    vec4 texColor = texture2D(u_texture, v_texcoord) * u_colorMult;
    gl_FragColor = vec4(texColor.rgb * light * shadowLight, texColor.a);
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
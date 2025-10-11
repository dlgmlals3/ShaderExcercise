let CanvasKit = null;
const lessons = {};
const maxLessons = 5;
const width = 300;
const height = 300;

// 텍스처 저장소
let textureImage = null;
let canvasKitImage = null;
let resizedCanvasKitImage = null;

// 2-Pass 범용 시스템
const twoPassSystem = {
    shaders: {},
    customUniforms: { blurRadius: 5.0 },
    uniformInfo: {}
};

// 기본 텍스처 경로 설정
const DEFAULT_TEXTURE_PATH = './texture.jpg';

// === iTime용 시작 시간 ===
let _t0 = performance.now();

// === iTime 전용 애니메이션 루프 ===
let _animReq = 0;
function _tick() {
    let any = false;
    for (let i = 1; i <= maxLessons; i++) {
        const L = lessons[i];
        if (L && L.shader && L.usesTime) {
            renderShader(i);
            any = true;
        }
    }
    if (any) _animReq = requestAnimationFrame(_tick);
    else _animReq = 0;
}

function ensureAnimation() {
  if (!_animReq) _tick();
}

// 이미지 로딩 함수
async function loadTexture(imagePath = DEFAULT_TEXTURE_PATH) {
    try {
        console.log(`텍스처 이미지 로딩 중: ${imagePath}`);
        
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`텍스처 로딩 실패: ${imagePath}, 기본 이미지 사용`);
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZjAwMDAiLz48c3RvcCBvZmZzZXQ9IjMzJSIgc3RvcC1jb2xvcj0iIzAwZmYwMCIvPjxzdG9wIG9mZnNldD0iNjYlIiBzdG9wLWNvbG9yPSIjMDAwMGZmIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZjAwIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9InVybCgjZ3JhZCkiLz48L3N2Zz4=';
                resolve();
            };
            img.src = imagePath;
        });
        
        textureImage = img;
        
        if (CanvasKit) {
            await createCanvasKitImage();
        }
        
        console.log('텍스처 이미지 로딩 완료');
        return true;
    } catch (error) {
        console.error('텍스처 이미지 로딩 실패:', error);
        return false;
    }
}

async function refreshTexture() {
    const cacheBuster = `?t=${Date.now()}`;
    const success = await loadTexture(DEFAULT_TEXTURE_PATH + cacheBuster);
    
    if (success && CanvasKit) {
        await createCanvasKitImage();
        for (let i = 1; i <= maxLessons; i++) {
            if (lessons[i] && lessons[i].usesTexture) {
                renderShader(i);
            }
        }
        // 2-Pass도 업데이트
        if (Object.keys(twoPassSystem.shaders).length === 2) {
            render2Pass();
        }
        console.log('텍스처 새로고침 완료');
    }
    return success;
}

async function createCanvasKitImage() {
    if (!CanvasKit || !textureImage) return;
    
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = textureImage.naturalWidth || textureImage.width;
        canvas.height = textureImage.naturalHeight || textureImage.height;
        
        ctx.drawImage(textureImage, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        canvasKitImage = CanvasKit.MakeImage({
            width: canvas.width,
            height: canvas.height,
            alphaType: CanvasKit.AlphaType.Unpremul,
            colorType: CanvasKit.ColorType.RGBA_8888,
            colorSpace: CanvasKit.ColorSpace.SRGB
        }, imageData.data, canvas.width * 4);
        
        // ✨ 300x300으로 리사이즈된 버전 생성
        const resizedCanvas = document.createElement('canvas');
        const resizedCtx = resizedCanvas.getContext('2d');
        resizedCanvas.width = width;
        resizedCanvas.height = height;
        resizedCtx.drawImage(textureImage, 0, 0, width, height);
        
        const resizedImageData = resizedCtx.getImageData(0, 0, width, height);
        
        if (resizedCanvasKitImage) {
            resizedCanvasKitImage.delete();
        }
        
        resizedCanvasKitImage = CanvasKit.MakeImage({
            width: width,
            height: height,
            alphaType: CanvasKit.AlphaType.Unpremul,
            colorType: CanvasKit.ColorType.RGBA_8888,
            colorSpace: CanvasKit.ColorSpace.SRGB
        }, resizedImageData.data, width * 4);
        
        console.log(`CanvasKit 이미지 생성 완료: ${canvas.width}×${canvas.height}`);
        console.log(`리사이즈 이미지 생성 완료: ${width}×${height}`);
    } catch (error) {
        console.error('CanvasKit 이미지 생성 실패:', error);
    }
}

async function initCanvasKit() {
    try {
        CanvasKit = await CanvasKitInit({
            locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/canvaskit-wasm/0.38.0/${file}`
        });

        if (textureImage) {
            await createCanvasKitImage();
        }

        for (let i = 1; i <= maxLessons; i++) {
            try {
                const canvas = document.getElementById(`canvas${i}`);
                const loading = document.getElementById(`loading${i}`);
                
                if (!canvas || !loading) {
                    console.warn(`레슨 ${i}: 필요한 DOM 요소가 없습니다`);
                    continue;
                }
                
                const surface = CanvasKit.MakeCanvasSurface(`canvas${i}`);
                if (surface) {
                    lessons[i] = {
                        surface: surface,
                        canvas: surface.getCanvas(),
                        usesTime: false,
                        usesTexture: false,
                        customUniforms: {}
                    };
                    
                    loading.style.display = 'none';
                    canvas.style.display = 'block';
                    
                    compileShader(i);
                } else {
                    console.error(`레슨 ${i}: 캔버스 surface 생성 실패`);
                }
            } catch (error) {
                console.error(`레슨 ${i} 초기화 실패:`, error);
            }
        }
    } catch (error) {
        console.error('CanvasKit 초기화 실패:', error);
    }
}

function showError(lessonNum, message) {
    document.getElementById(`error${lessonNum}`).innerHTML = 
        `<div class="error"> ${message}</div>`;
}

function clearError(lessonNum) {
    document.getElementById(`error${lessonNum}`).innerHTML = '';
}

function makeGraphShader(funcBody = "float y = sin(3.14159 * p.x);") {
    return `
    uniform float2 iResolution;
    uniform float iTime;
    
    float rand(float2 uv) { 
        return fract(sin(dot(uv.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
        
    half4 main(float2 fragCoord) {
        float2 uv = fragCoord / iResolution;
        uv.y *= iResolution.y / iResolution.x;

        float2 p = float2(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0);                
        
        ${funcBody}

        float lineThickness = 0.03;
        float d = abs(p.y - y);
        float line = 1.0 - smoothstep(0.0, lineThickness, d);

        float ax = 1.0 - smoothstep(0.0, 0.05, abs(p.x));
        float ay = 1.0 - smoothstep(0.0, 0.05, abs(p.y));

        float3 col = float3(0.01, 0.1, 0.11);

        col = mix(col, float3(0.3,0.3,0.3), ax + ay);

        col = mix(col, float3(1.0,0.2,0.2), line);

        return half4(col, 1.0);
    }`;
}

// ✨ uniform 자동 감지 및 파싱
function parseUniforms(skslCode) {
    const uniforms = { names: [], hasTime: false, hasResolution: false };
    
    // iTime 체크
    if (/\biTime\b/.test(skslCode)) {
        uniforms.hasTime = true;
    }
    
    // iResolution 체크
    if (/\biResolution\b/.test(skslCode)) {
        uniforms.hasResolution = true;
    }
    
    // 커스텀 uniform 추출
    const uniformPattern = /uniform\s+float\s+(\w+);/g;
    let match;
    while ((match = uniformPattern.exec(skslCode)) !== null) {
        const uniformName = match[1];
        if (uniformName !== 'iTime' && !uniformName.startsWith('iResolution')) {
            uniforms.names.push(uniformName);
        }
    }
    
    return uniforms;
}

function compileSinglePass(passNum) {
    const editor = document.getElementById(`editor_pass_${passNum}`);
    if (!editor) {
        showError(passNum + 1, `Pass ${passNum} 에디터를 찾을 수 없습니다`);
        return null;
    }
    
    const skslCode = editor.value;
    if (!skslCode || skslCode.trim() === '') {
        showError(passNum + 1, `Pass ${passNum} 셰이더 코드가 비어있습니다`);
        return null;
    }
    
    console.log(`Pass ${passNum} SKSL 코드:`, skslCode);
    
    let errText = null;
    const effect = CanvasKit.RuntimeEffect.Make(skslCode, (err) => {
        errText = err;
    });
    
    if (!effect) {
        showError(passNum + 1, `Pass ${passNum} 컴파일 실패:<br/>${(errText || 'Unknown error').replace(/\n/g, '<br/>')}`);
        return null;
    }
    
    return {
        effect: effect,
        uniformInfo: parseUniforms(skslCode)
    };
}

function compile4Pass() {
    if (!CanvasKit) return;
    
    console.log("4-Pass 컴파일 시작");
    clearError(2);
    
    const compiledShaders = {};
    const uniformInfo = {};
    
    // Pass 1, 2, 3 컴파일
    for (let i = 1; i <= 4; i++) {
        const result = compileSinglePass(i);
        if (!result) return; // 컴파일 실패시 중단
        
        compiledShaders[`pass_${i}`] = result.effect;
        uniformInfo[`pass_${i}`] = result.uniformInfo;
    }
        
    Object.values(twoPassSystem.shaders).forEach(shader => {
        try { shader.delete(); } catch {}
    });
    
    twoPassSystem.shaders = compiledShaders;
    twoPassSystem.uniformInfo = uniformInfo;
    
    render4Pass();
}

function buildUniformsArray(uniformInfo, customUniforms) {
    const uniformsArray = [];
    
    if (uniformInfo.hasResolution) {
        uniformsArray.push(width, height);
    }
    
    if (uniformInfo.hasTime) {
        const t = (performance.now() - _t0) / 1000.0;
        uniformsArray.push(t);
    }
    
    for (const uniformName of uniformInfo.names) {
        const value = customUniforms[uniformName] || 0.0;
        uniformsArray.push(value);
    }
    
    return new Float32Array(uniformsArray);
}

function renderSinglePass(passNum, canvasIndex, shader, inputShader) {
    const rt = lessons[canvasIndex];
    const uniformInfo = twoPassSystem.uniformInfo[`pass_${passNum}`];
    
    const uniforms = buildUniformsArray(uniformInfo, twoPassSystem.customUniforms);
    
    const passShader = shader.makeShaderWithChildren(uniforms, [inputShader]);
    const paint = new CanvasKit.Paint();
    paint.setShader(passShader);
    
    rt.canvas.clear(CanvasKit.WHITE);
    rt.canvas.drawRect(CanvasKit.LTRBRect(0, 0, width, height), paint);
    rt.surface.flush();
    
    return { passShader, paint };
}

function render4Pass() {
    console.time('render4Pass_total');
    
    if (!resizedCanvasKitImage) {
        showError(2, '셰이더가 컴파일되지 않았습니다');
        return;
    }
    
    if (!lessons[2] || !lessons[2].canvas || !lessons[3] || !lessons[3].canvas || !lessons[4] || !lessons[4].canvas) {
        console.error('Canvas 2, 3, 4가 초기화되지 않았습니다');
        return;
    }
    
    try {
        const toCleanup = [];
        
        // Pass 1: 원본 이미지 사용
        const imageShader = resizedCanvasKitImage.makeShaderOptions(
            CanvasKit.TileMode.Clamp,
            CanvasKit.TileMode.Clamp,
            CanvasKit.FilterMode.Linear,
            CanvasKit.MipmapMode.None
        );
        toCleanup.push(imageShader);
        
        const pass1 = renderSinglePass(1, 2, twoPassSystem.shaders.pass_1, imageShader);
        toCleanup.push(pass1.paint);
        
        const snapshot1 = lessons[2].surface.makeImageSnapshot();
        const pass1Shader = snapshot1.makeShaderOptions(
            CanvasKit.TileMode.Clamp,
            CanvasKit.TileMode.Clamp,
            CanvasKit.FilterMode.Linear,
            CanvasKit.MipmapMode.None
        );
        toCleanup.push(snapshot1, pass1Shader);
        
        // Pass 2: Pass 1의 shader 사용
        const pass2 = renderSinglePass(2, 3, twoPassSystem.shaders.pass_2, pass1.passShader);
        toCleanup.push(pass1.passShader, pass2.paint);
        
        const snapshot2 = lessons[3].surface.makeImageSnapshot();
        const pass2Shader = snapshot2.makeShaderOptions(
            CanvasKit.TileMode.Clamp,
            CanvasKit.TileMode.Clamp,
            CanvasKit.FilterMode.Linear,
            CanvasKit.MipmapMode.None
        );
        toCleanup.push(snapshot2, pass2Shader);
        
        // Pass 3: Pass 2의 shader 사용
        const pass3 = renderSinglePass(3, 4, twoPassSystem.shaders.pass_3, pass2.passShader);
        toCleanup.push(pass2.passShader, pass3.passShader, pass3.paint);
        const snapshot3 = lessons[4].surface.makeImageSnapshot();
        const pass3Shader = snapshot3.makeShaderOptions(
            CanvasKit.TileMode.Clamp,
            CanvasKit.TileMode.Clamp,
            CanvasKit.FilterMode.Linear,
            CanvasKit.MipmapMode.None
        );

        // Pass 4: Pass 3의 shader 사용
        const pass4 = renderSinglePass(4, 5, twoPassSystem.shaders.pass_4, pass3.passShader);
        toCleanup.push(pass3.passShader, pass3.paint);


        //모든 리소스 정리
        toCleanup.forEach(resource => {
            try { resource.delete(); } catch (e) {}
        });
        
        console.timeEnd('render4Pass_total');
        
    } catch (error) {
        showError(2, '3-Pass 렌더링 오류: ' + error.message);
        console.error(error);
    }
}


// function render2Pass() {
//     console.time('render2Pass_total');
    
//     if (!resizedCanvasKitImage || Object.keys(twoPassSystem.shaders).length !== 2) {
//         showError(2, '셰이더가 컴파일되지 않았습니다');
//         return;
//     }
    
//     if (!lessons[2] || !lessons[2].canvas || !lessons[3] || !lessons[3].canvas) {
//         console.error('Canvas 2 또는 Canvas 3이 초기화되지 않았습니다');
//         return;
//     }
    
//     try {
//         // === Pass 1: canvas2에 렌더링 ===
//         const rt1 = lessons[2];
//         const uniforms1Array = [];
//         const uniformInfo1 = twoPassSystem.uniformInfo.pass_1;
        
//         if (uniformInfo1.hasResolution) {
//             uniforms1Array.push(width, height);
//         }
        
//         if (uniformInfo1.hasTime) {
//             const t = (performance.now() - _t0) / 1000.0;
//             uniforms1Array.push(t);
//         }
        
//         for (const uniformName of uniformInfo1.names) {
//             const value = twoPassSystem.customUniforms[uniformName] || 0.0;
//             uniforms1Array.push(value);
//         }
        
//         const uniforms1 = new Float32Array(uniforms1Array);
        
//         const imageShader = resizedCanvasKitImage.makeShaderOptions(
//             CanvasKit.TileMode.Clamp,
//             CanvasKit.TileMode.Clamp,
//             CanvasKit.FilterMode.Linear,
//             CanvasKit.MipmapMode.None
//         );
        
//         const shader1 = twoPassSystem.shaders.pass_1.makeShaderWithChildren(uniforms1, [imageShader]);
//         const paint1 = new CanvasKit.Paint();
//         paint1.setShader(shader1);
        
//         console.time('Pass1_draw');
        
//         rt1.canvas.clear(CanvasKit.WHITE);
//         rt1.canvas.drawRect(CanvasKit.LTRBRect(0, 0, width, height), paint1);
//         rt1.surface.flush();

//         console.timeEnd('Pass1_draw');
        
//         console.time('Pass1_snapshot');
//         const snapshot1 = rt1.surface.makeImageSnapshot();
//         const pass1Shader = snapshot1.makeShaderOptions(
//             CanvasKit.TileMode.Clamp,
//             CanvasKit.TileMode.Clamp,
//             CanvasKit.FilterMode.Linear,
//             CanvasKit.MipmapMode.None
//         );
//         console.timeEnd('Pass1_snapshot');
                

//         // === Pass 2: canvas3에 렌더링 ===
//         const rt2 = lessons[3];
//         const uniforms2Array = [];
//         const uniformInfo2 = twoPassSystem.uniformInfo.pass_2;
//         if (uniformInfo2.hasResolution) {
//             uniforms2Array.push(width, height);
//         }
//         if (uniformInfo2.hasTime) {
//             const t = (performance.now() - _t0) / 1000.0;
//             uniforms2Array.push(t);
//         }
//         for (const uniformName of uniformInfo2.names) {
//             const value = twoPassSystem.customUniforms[uniformName] || 0.0;
//             uniforms2Array.push(value);
//         }        
//         const uniforms2 = new Float32Array(uniforms2Array);
//         const shader2 = twoPassSystem.shaders.pass_2.makeShaderWithChildren(uniforms2, [shader1]);
//         const paint2 = new CanvasKit.Paint();
//         paint2.setShader(shader2);
        
//         console.time('Pass2_draw');
//         rt2.canvas.clear(CanvasKit.WHITE);
//         rt2.canvas.drawRect(CanvasKit.LTRBRect(0, 0, width, height), paint2);
//         rt2.surface.flush();
//         console.timeEnd('Pass2_draw');
        


        
//         shader1.delete();
//         shader2.delete();
//         shader3.delete();
//         imageShader.delete();
//         paint1.delete();        
        
//         paint2.delete();
//         pass1Shader.delete();
//         snapshot1.delete();
        
//         console.timeEnd('render2Pass_total');
//         console.log('✓ Pass 1 결과: canvas2, Pass 2 결과: canvas3');
        
//     } catch (error) {
//         showError(2, '2-Pass 렌더링 오류: ' + error.message);
//         console.error(error);
//     }
// }

// ✨ 2-Pass uniform 업데이트
function updateMultiPassRadius(value) {
    const radiusDisplay = document.getElementById('radiusValue_multipass');
    if (radiusDisplay) {
        radiusDisplay.textContent = parseFloat(value).toFixed(1);
    }
    twoPassSystem.customUniforms.blurRadius = parseFloat(value);
        
    render4Pass();
}

// 전역 함수로 노출
window.compile4Pass = compile4Pass;
window.updateMultiPassRadius = updateMultiPassRadius;

function compileShader(lessonNum) {
    if (!CanvasKit || !lessons[lessonNum]) return;
    
    console.log("compileShader", lessonNum);
    clearError(lessonNum);

    const editor = document.getElementById(`editor${lessonNum}`);
    let skslCode = editor?.value ?? '';

    changeTexture("./materials/images/image3.jpg");
    if (lessonNum == 1) {
        skslCode = makeGraphShader(editor?.value);
    }
    
    const usesTexture = /\biTexture\b/.test(skslCode);
    const usesTime    = /\biTime\b/.test(skslCode);
    
    const customUniformPattern = /uniform\s+float\s+(\w+);/g;
    const customUniforms = {};
    let match;
    while ((match = customUniformPattern.exec(skslCode)) !== null) {
        const uniformName = match[1];
        if (uniformName !== 'iTime' && !uniformName.startsWith('iResolution')) {
            customUniforms[uniformName] = lessons[lessonNum].customUniforms[uniformName] || 0.0;
        }
    }

    if (lessons[lessonNum].shader) {
        try { lessons[lessonNum].shader.delete(); } catch {}
        lessons[lessonNum].shader = null;
    }

    let errText = null;

    const effect = CanvasKit.RuntimeEffect.Make(skslCode, (err) => {
        errText = err;
    });

    if (!effect) {
        showError(lessonNum, (errText || 'SKSL 컴파일 실패').replace(/\n/g, '<br/>'));
        return;
    }
    
    lessons[lessonNum].shader = effect;
    lessons[lessonNum].usesTexture = usesTexture;
    lessons[lessonNum].usesTime    = usesTime;
    lessons[lessonNum].customUniforms = customUniforms;
    
    if (usesTime) ensureAnimation();

    renderShader(lessonNum);
}

function renderShader(lessonNum) {
    const lesson = lessons[lessonNum];
    if (!lesson.shader || !lesson.canvas) return;

    try {
        let uniformsArray = [width, height];

        if (lesson.usesTime) {
            const t = (performance.now() - _t0) / 1000.0;
            uniformsArray.push(t);
        }
        
        for (const [name, value] of Object.entries(lesson.customUniforms)) {
            uniformsArray.push(value);
        }
        
        const uniforms = new Float32Array(uniformsArray);
        
        let shaderInstance;
        
        if (lesson.usesTexture && canvasKitImage) {
            const sx = width  / canvasKitImage.width();
            const sy = height / canvasKitImage.height();

            const localMatrix = new Float32Array([
                sx, 0,  0,
                0,  sy, 0,
                0,  0,  1
            ]);

            const imageShader = canvasKitImage.makeShaderOptions(
                CanvasKit.TileMode.Clamp,
                CanvasKit.TileMode.Clamp,
                CanvasKit.FilterMode.Linear,
                CanvasKit.MipmapMode.None,
                localMatrix
            );
                
            shaderInstance = lesson.shader.makeShaderWithChildren(
                uniforms,
                [imageShader]
            );
            
            imageShader.delete();
        } else {
            shaderInstance = lesson.shader.makeShader(uniforms);
        }

        const paint = new CanvasKit.Paint();
        paint.setShader(shaderInstance);

        lesson.canvas.clear(CanvasKit.WHITE);
        lesson.canvas.drawRect(CanvasKit.LTRBRect(0, 0, width, height), paint);
        lesson.surface.flush();

        shaderInstance.delete();
        paint.delete();
        
    } catch (error) {
        showError(lessonNum, '렌더링 오류: ' + error.message);
    }
}

function setUniformValue(lessonNum, uniformName, value) {
    if (!lessons[lessonNum]) return;
    
    lessons[lessonNum].customUniforms[uniformName] = value;
    renderShader(lessonNum);
}

window.setUniformValue = setUniformValue;

function setupKeyboardEvents(lessonNum) {
    const editor = document.getElementById(`editor${lessonNum}`);
    if (editor) {
        editor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                compileShader(lessonNum);
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                refreshTexture();
            }
            
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
    }
}

// ✨ 2-Pass 에디터들에도 키보드 이벤트 설정
function setup2PassKeyboardEvents() {
    const passNames = ['pass_1', 'pass_2'];
    
    passNames.forEach(passName => {
        const editor = document.getElementById(`editor_${passName}`);
        if (editor) {
            editor.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    compile2Pass();
                }
                
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    refreshTexture();
                }
                
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = editor.selectionStart;
                    const end = editor.selectionEnd;
                    
                    editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                    editor.selectionStart = editor.selectionEnd = start + 4;
                }
            });
        }
    });
}

async function changeTexture(imagePath) {
    const success = await loadTexture(imagePath);
    if (success && CanvasKit) {
        await createCanvasKitImage();
        for (let i = 1; i <= maxLessons; i++) {
            if (lessons[i] && lessons[i].usesTexture) {
                renderShader(i);
            }
        }
        // 2-Pass도 업데이트
        if (Object.keys(twoPassSystem.shaders).length === 2) {
            render2Pass();
        }
    }
}

window.addEventListener('beforeunload', () => {
    // 2-Pass 셰이더 정리
    Object.values(twoPassSystem.shaders).forEach(shader => {
        try {
            shader.delete();
        } catch (e) {
            console.warn('2-Pass 셰이더 정리 중 오류:', e);
        }
    });
    
    if (resizedCanvasKitImage) {
        try {
            resizedCanvasKitImage.delete();
        } catch (e) {
            console.warn('리사이즈 이미지 정리 중 오류:', e);
        }
    }
    
    if (canvasKitImage) {
        try {
            canvasKitImage.delete();
        } catch (e) {
            console.warn('텍스처 이미지 정리 중 오류:', e);
        }
    }
    
    Object.values(lessons).forEach(lesson => {
        if (lesson && lesson.shader) {
            try {
                lesson.shader.delete();
            } catch (e) {
                console.warn('셰이더 정리 중 오류:', e);
            }
        }
        if (lesson && lesson.surface) {
            try {
                lesson.surface.delete();
            } catch (e) {
                console.warn('Surface 정리 중 오류:', e);
            }
        }
    });
});

// 초기화
Promise.all([
    loadTexture(),
    initCanvasKit()
]).then(() => {
    for (let i = 1; i <= maxLessons; i++) {
        setupKeyboardEvents(i);
    }
    
    // 2-Pass 에디터 키보드 이벤트 설정
    setup2PassKeyboardEvents();
    
    console.log('모든 초기화 완료');
    console.log('텍스처 파일 경로:', DEFAULT_TEXTURE_PATH);
    console.log('텍스처 새로고침: Ctrl+R');
    console.log('2-Pass 시스템: Ctrl+Enter로 각 패스 편집 후 "2-Pass 실행" 버튼 클릭');
});
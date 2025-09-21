let CanvasKit = null;
const lessons = {};
const maxLessons = 5;
const width = 300;
const height = 300;

// 텍스처 저장소
let textureImage = null;
let canvasKitImage = null;

// 기본 텍스처 경로 설정
const DEFAULT_TEXTURE_PATH = './texture.jpg'; // 로컬 경로

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
    else _animReq = 0; // 더 이상 iTime 쓰는 레슨 없으면 정지
}

function ensureAnimation() {
  if (!_animReq) _tick(); // 아직 돌고 있지 않으면 시작
}

// 이미지 로딩 함수 (로컬 경로 사용)
async function loadTexture(imagePath = DEFAULT_TEXTURE_PATH) {
    try {
        console.log(`텍스처 이미지 로딩 중: ${imagePath}`);
        
        // HTML Image 로드
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`텍스처 로딩 실패: ${imagePath}, 기본 이미지 사용`);
                // 기본 이미지로 폴백
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNmZjAwMDAiLz48c3RvcCBvZmZzZXQ9IjMzJSIgc3RvcC1jb2xvcj0iIzAwZmYwMCIvPjxzdG9wIG9mZnNldD0iNjYlIiBzdG9wLWNvbG9yPSIjMDAwMGZmIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmZmZjAwIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIGZpbGw9InVybCgjZ3JhZCkiLz48L3N2Zz4=';
                resolve();
            };
            img.src = imagePath;
        });
        
        textureImage = img;
        
        // CanvasKit이 준비되면 CanvasKit Image로 변환
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

// 텍스처 새로고침 함수 (개발 중 텍스처 파일이 바뀔 때 사용)
async function refreshTexture() {
    // 캐시 방지를 위해 timestamp 추가
    const cacheBuster = `?t=${Date.now()}`;
    const success = await loadTexture(DEFAULT_TEXTURE_PATH + cacheBuster);
    
    if (success && CanvasKit) {
        await createCanvasKitImage();
        // 텍스처를 사용하는 모든 레슨 다시 렌더링
        for (let i = 1; i <= maxLessons; i++) {
            if (lessons[i] && lessons[i].usesTexture) {
                renderShader(i);
            }
        }
        console.log('텍스처 새로고침 완료');
    }
    return success;
}

// CanvasKit Image 생성
async function createCanvasKitImage() {
    if (!CanvasKit || !textureImage) return;
    
    try {
        // HTML Image를 Canvas로 변환 (원본 크기 유지)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 원본 이미지 크기 사용
        canvas.width = textureImage.naturalWidth || textureImage.width;
        canvas.height = textureImage.naturalHeight || textureImage.height;
        
        ctx.drawImage(textureImage, 0, 0);
        
        // ImageData 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // CanvasKit Image 생성
        canvasKitImage = CanvasKit.MakeImage({
            width: canvas.width,
            height: canvas.height,
            alphaType: CanvasKit.AlphaType.Unpremul,
            colorType: CanvasKit.ColorType.RGBA_8888,
            colorSpace: CanvasKit.ColorSpace.SRGB
        }, imageData.data, canvas.width * 4);
        
        console.log(`CanvasKit 이미지 생성 완료: ${canvas.width}×${canvas.height}`);
    } catch (error) {
        console.error('CanvasKit 이미지 생성 실패:', error);
    }
}

// CanvasKit 초기화
async function initCanvasKit() {
    try {
        CanvasKit = await CanvasKitInit({
            locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/canvaskit-wasm/0.38.0/${file}`
        });

        // 텍스처 이미지가 이미 로드되었다면 CanvasKit Image 생성
        if (textureImage) {
            await createCanvasKitImage();
        }

        // 각 레슨 초기화
        for (let i = 1; i <= maxLessons; i++) {
            try {
                const canvas = document.getElementById(`canvas${i}`);
                const loading = document.getElementById(`loading${i}`);
                
                // 요소가 존재하지 않으면 스킵
                if (!canvas || !loading) {
                    console.warn(`레슨 ${i}: 필요한 DOM 요소가 없습니다`);
                    continue;
                }
                
                const surface = CanvasKit.MakeCanvasSurface(`canvas${i}`);
                if (surface) {
                    lessons[i] = {
                        surface: surface,
                        canvas: surface.getCanvas(),
                        usesTime: false,   // iTime 사용 여부
                        usesTexture: false // iTexture 사용 여부
                    };
                    
                    loading.style.display = 'none';
                    canvas.style.display = 'block';
                    
                    // 초기 컴파일
                    compileShader(i);
                } else {
                    console.error(`레슨 ${i}: 캔버스 surface 생성 실패`);
                }
            } catch (error) {
                console.error(`레슨 ${i} 초기화 실패:`, error);
                // 실패해도 다음 레슨 초기화 계속 진행
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

    float rand(float2 uv) { 
        return fract(sin(dot(uv.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
        
    half4 main(float2 fragCoord) {
        float2 uv = fragCoord / iResolution;   // 0 ~ 1 좌표
        uv.y *= iResolution.y / iResolution.x;

        // skia y축이 아래로 향하므로 y축 반전        
        // 좌표계 범위: x: -1 ~ 1, y: -1 ~ 1     
        float2 p = float2(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0);                
        
        ${funcBody}

        float lineThickness = 0.03;
        float d = abs(p.y - y);
        float line = 1.0 - smoothstep(0.0, lineThickness, d);

        // 좌표축
        float ax = 1.0 - smoothstep(0.0, 0.05, abs(p.x));
        float ay = 1.0 - smoothstep(0.0, 0.05, abs(p.y));

        // 배경색
        float3 col = float3(0.01, 0.1, 0.11);

        // 축 색 적용
        col = mix(col, float3(0.3,0.3,0.3), ax + ay);

        // 그래프 색 적용
        col = mix(col, float3(1.0,0.2,0.2), line);

        return half4(col, 1.0);
    }`;
}

// !!! makeTextureShader 제거됨 !!!

function compileShader(lessonNum) {
    if (!CanvasKit || !lessons[lessonNum]) return;
    
    console.log("compileShader", lessonNum);
    clearError(lessonNum);

    const editor = document.getElementById(`editor${lessonNum}`);
    let skslCode = editor?.value ?? '';

    // 그래프 코드 스터디를 위한 코드.
    changeTexture("./materials/images/image3.jpg");
    if (lessonNum == 1) {
        skslCode = makeGraphShader(editor?.value);
    }
    
    // 텍스처/시간 사용 여부 감지 (래퍼 사용 안 함)
    const usesTexture = /\biTexture\b/.test(skslCode);
    const usesTime    = /\biTime\b/.test(skslCode);

    // 기존 셰이더 정리
    if (lessons[lessonNum].shader) {
        try { lessons[lessonNum].shader.delete(); } catch {}
        lessons[lessonNum].shader = null;
    }

    let errText = null;

    // 상세 컴파일 오류를 여기서 받음
    const effect = CanvasKit.RuntimeEffect.Make(skslCode, (err) => {
        errText = err; // 전체 에러 문자열(줄/칼럼 포함)
    });

    if (!effect) {
        // UI에 출력
        showError(lessonNum, (errText || 'SKSL 컴파일 실패').replace(/\n/g, '<br/>'));
        return;
    }
    
    lessons[lessonNum].shader = effect;
    lessons[lessonNum].usesTexture = usesTexture;
    lessons[lessonNum].usesTime    = usesTime;
    if (usesTime) ensureAnimation(); // iTime 쓰면 루프 보장

    renderShader(lessonNum);
}

function renderShader(lessonNum) {
    const lesson = lessons[lessonNum];
    if (!lesson.shader || !lesson.canvas) return;

    try {
        // iResolution만 기본 전달
        let uniforms = new Float32Array([width, height]);

        // iTime 쓰면 마지막에 추가
        if (lesson.usesTime) {
            const t = (performance.now() - _t0) / 1000.0;
            const u = new Float32Array(uniforms.length + 1);
            u.set(uniforms, 0);
            u[uniforms.length] = t; // iTime
            uniforms = u;
        }
        
        let shaderInstance;
        
        if (lesson.usesTexture && canvasKitImage) {
            // 텍스처를 사용하는 셰이더: 캔버스→이미지 stretch 매핑
            const sx = width  / canvasKitImage.width();
            const sy = height / canvasKitImage.height();

            // SkMatrix (column-major 3x3)
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
                [imageShader] // children shaders (텍스처)
            );
            
            imageShader.delete();
        } else {
            // 일반 셰이더
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

// 키보드 이벤트 설정
function setupKeyboardEvents(lessonNum) {
    const editor = document.getElementById(`editor${lessonNum}`);
    if (editor) {
        editor.addEventListener('keydown', (e) => {
            // Ctrl+Enter로 컴파일
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                compileShader(lessonNum);
            }
            
            // Ctrl+R로 텍스처 새로고침
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                refreshTexture();
            }
            
            // Tab 키로 들여쓰기
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

// 텍스처 이미지 변경 함수 (다른 경로 지정 시 사용)
async function changeTexture(imagePath) {
    const success = await loadTexture(imagePath);
    if (success && CanvasKit) {
        await createCanvasKitImage();
        // 텍스처를 사용하는 모든 레슨 다시 렌더링
        for (let i = 1; i <= maxLessons; i++) {
            if (lessons[i] && lessons[i].usesTexture) {
                renderShader(i);
            }
        }
    }
}

// 정리
window.addEventListener('beforeunload', () => {
    // 텍스처 정리
    if (canvasKitImage) {
        try {
            canvasKitImage.delete();
        } catch (e) {
            console.warn('텍스처 이미지 정리 중 오류:', e);
        }
    }
    
    // 레슨들 정리
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

// 초기화 시작
Promise.all([
    loadTexture(), // 로컬 텍스처 로드 (./texture.jpg)
    initCanvasKit() // CanvasKit 초기화
]).then(() => {
    for (let i = 1; i <= maxLessons; i++) {
        setupKeyboardEvents(i);
    }
    
    console.log('모든 초기화 완료');
    console.log('텍스처 파일 경로:', DEFAULT_TEXTURE_PATH);
    console.log('텍스처 새로고침: Ctrl+R');
});

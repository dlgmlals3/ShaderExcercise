let CanvasKit = null;
const lessons = {};
const maxLessons = 2;
const width = 300;
const height = 300;

// CanvasKit 초기화
async function initCanvasKit() {
    try {
        CanvasKit = await CanvasKitInit({
            locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/canvaskit-wasm/0.38.0/${file}`
        });

        // 각 레슨 초기화
        for (let i = 1; i <= maxLessons; i++) {
            const canvas = document.getElementById(`canvas${i}`);
            const loading = document.getElementById(`loading${i}`);            
            const surface = CanvasKit.MakeCanvasSurface(`canvas${i}`);
            if (surface) {
                lessons[i] = {
                    surface: surface,
                    canvas: surface.getCanvas()
                };
                
                loading.style.display = 'none';
                canvas.style.display = 'block';
                
                // 초기 컴파일
                compileShader(i);
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
    half4 main(float2 fragCoord) {
        float2 uv = fragCoord / iResolution;   // 0 ~ 1 좌표
            
        // skia y축이 아래로 향하므로 y축 반전
        // float2 p = uv * 2.0 - 1.0;
        float2 p = float2(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0);        
        // 좌표계 범위: x: -1 ~ 1, y: -1 ~ 1        
        ${funcBody}

        float lineThickness = 0.05;
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

function compileShader(lessonNum) {
    if (!CanvasKit || !lessons[lessonNum]) return;
    // dlgmlals3
    console.log("compileShader", lessonNum);

    clearError(lessonNum);

    const editor = document.getElementById(`editor${lessonNum}`);
    skslCode = editor.value ?? '';

    // 그래프 코드 스터디를 위한 코드.
    if (lessonNum == 1) {
        skslCode = makeGraphShader(editor.value);
    }

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
    renderShader(lessonNum);
}

function renderShader(lessonNum) {
    const lesson = lessons[lessonNum];
    if (!lesson.shader || !lesson.canvas) return;

    try {
        // uniform 설정 (해상도)
        const uniforms = new Float32Array([width, height]); // iResolution

        const shaderInstance = lesson.shader.makeShader(uniforms);
        const paint = new CanvasKit.Paint();
        paint.setShader(shaderInstance);

        lesson.canvas.clear(CanvasKit.WHITE);
        lesson.canvas.drawRect(CanvasKit.LTRBRect(0, 0, width, height), paint);
        lesson.surface.flush();

        //paint.delete();
        shaderInstance.delete();
        
    } catch (error) {
        showError(lessonNum, '렌더링 오류: ' + error.message);
    }
}

// 키보드 이벤트 설정
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
            
            // Tab 키로 들여쓰기
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                
                editor.value = 
                  editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
    }
}

// 정리
window.addEventListener('beforeunload', () => {
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
initCanvasKit().then(() => {
    for (let i = 1; i <= maxLessons; i++) {
        setupKeyboardEvents(i);
    }
});
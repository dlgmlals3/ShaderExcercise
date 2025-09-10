let CanvasKit = null;
const lessons = {};
const maxLessons = 2;

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

function compileShader(lessonNum) {
    if (!CanvasKit || !lessons[lessonNum]) return;

    clearError(lessonNum);

    const editor = document.getElementById(`editor${lessonNum}`);
    const skslCode = editor.value ?? '';

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
        const uniforms = new Float32Array([300, 300]); // iResolution

        const shaderInstance = lesson.shader.makeShader(uniforms);
        const paint = new CanvasKit.Paint();
        paint.setShader(shaderInstance);

        lesson.canvas.clear(CanvasKit.WHITE);
        lesson.canvas.drawRect(CanvasKit.LTRBRect(0, 0, 300, 300), paint);
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
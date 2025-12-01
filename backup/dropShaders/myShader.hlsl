#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec4 N14(float t) {
	return fract(sin(t*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
}
float N(float t) {
    return fract(sin(t*12345.564)*7658.76);
}

float N21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float curve(float b, float t) {
	return S(0., b, t) * S(1., b, t);
}


vec3 DropLayer(vec2 uv, float t) {
    float xGrid = 12.0;
    float yGrid = 3.0;
    float ratio = yGrid / xGrid;
    
    vec2 grid = vec2(xGrid, yGrid);
    
    // 각 x=1~N개의 막대기마다 다른 스피드를 가짐
    vec2 id = floor(uv * grid);
    float speed = fract(N(id.x + 1.0)) * 2.0;
    float controlX = 3.14 * id.x;
    float speedControl = -(sin(t + sin(t + sin(t)*.5))) * 0.05;
    speedControl = 1.0;    

    // 각 x=1~N개의 막대기 마다 다른 오프셋을 가짐
    float offset = fract(N(id.x + 1.0));
    float time = t * speed * speedControl;
    

    uv.y += time + offset;
    uv = fract(uv * grid) - .5;    
    // debug
    //if (uv.x < 0.5 && uv.x > 0.45) return vec3(1.0, 0.0, 0.0);
    //if (uv.y < 0.5 && uv.y > 0.45) return vec3(1.0, 0.0, 0.0);    
    
    float y = curve(.8, fract(t + offset));
    //y = (curve(.85, fract(t * 2.)) - .5) * .9 + .5; 
    uv.y -= y;

    uv.x *= ratio;    
    float distance = length(uv);
    float circleRadius = 0.05;
    float circleSoft = 0.01;
    float isCircle = 1. - smoothstep(circleRadius - circleSoft, circleRadius + circleSoft, distance);

    return vec3(vec2(isCircle), 0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord / iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;    
    float t = iTime * 0.5;
    vec3 col = DropLayer(uv, t);
    fragColor = vec4(col, 1.);
}
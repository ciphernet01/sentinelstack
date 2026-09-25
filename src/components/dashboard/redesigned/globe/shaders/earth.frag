uniform float uTime;
varying float vSeed;
varying float vDepth;
void main(){
  vec2 uv=gl_PointCoord-vec2(0.5);
  float d=length(uv);
  if(d>0.5) discard;
  float core=1.0-smoothstep(0.03,0.46,d);
  float halo=1.0-smoothstep(0.16,0.5,d);
  float shimmer=0.97+0.03*sin(uTime*0.55+vSeed*17.0);
  vec3 color=mix(vec3(0.12,0.88,0.94),vec3(0.86,1.0,1.0),core);
  float alpha=(core*1.0+halo*0.5)*shimmer;
  alpha*=clamp(0.78+vDepth*0.32,0.72,1.0);
  gl_FragColor=vec4(color,alpha);
}

attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uPixelRatio;
varying float vSeed;
varying float vDepth;
void main(){
  vSeed=aSeed;
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  float depthScale=clamp(1.0/max(0.35,-mvPosition.z),0.0,2.4);
  gl_PointSize=aSize*(10.8+sin(uTime*0.45+aSeed*8.0)*0.35)*uPixelRatio*depthScale;
  gl_Position=projectionMatrix*mvPosition;
  vDepth=depthScale;
}

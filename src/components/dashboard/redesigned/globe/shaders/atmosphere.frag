uniform vec3 uCameraPosition;
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPosition;
void main(){vec3 viewDirection=normalize(uCameraPosition-vWorldPosition);float fresnel=pow(1.0-max(dot(normalize(vNormal),viewDirection),0.0),3.2);float alpha=fresnel*uIntensity;gl_FragColor=vec4(uColor,alpha);}
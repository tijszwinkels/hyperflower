#version 320 es
precision highp float;
// Prism Hyperspace flower, adapted from the Companion neon-wormhole widget.
// Fixed rainbow palette and cruise speed preserve the approved appearance.
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed_scale;
out vec4 fragColor;
vec3 palette(float v) { return .52+.48*cos(6.28318*(v+vec3(0.,.33,.67))); }
// Folding filigree; detail survives only while drift stays within ~[-1.5,3.5].
vec3 filigree(float fold, float depth, float t, float drift) {
    vec3 col=vec3(0.);
    vec2 p=vec2(fold*2.-1.,depth*.22-drift);
    for(int i=0;i<4;i++) {
        float fi=float(i);
        p=abs(p)/max(dot(p,p),.32)-vec2(.85+.12*sin(t*.5),1.1);
        float d=abs(length(p)-(.65+.15*sin(t*.6+fi)));
        col+=palette(fi*.21+depth*.08+t*.05)*(.018/(d+.055))*.23;
    }
    return col;
}
void main() {
    vec2 uv=(2.*gl_FragCoord.xy-u_resolution)/min(u_resolution.x,u_resolution.y);
    float time=u_time*u_speed_scale*.5;
    float r=length(uv), a=atan(uv.y,uv.x);
    float t=time*.6;
    float petal=1.+.13*sin(6.*a+t)+.07*cos(9.*a-t*.7);
    float depth=1.6/(r*petal+.22);
    float z=depth+time;
    float twist=a+depth*.46+.38*sin(depth*.7-t);
    float fold=abs(fract(twist/6.28318*8.)-.5)*2.;
    float rings=abs(sin(z*2.6+fold*3.+sin(twist*6.-t)));
    float rails=abs(sin(twist*12.+sin(z*1.4)*1.8));
    vec3 col=palette(depth*.16+fold*.42-t*.09)*(.035+.65*exp(-rings*24.));
    col+=palette(fold*.6-depth*.1+t*.08)*exp(-rails*30.)*.65;
    col+=palette(z*.06+fold*.3)*exp(-rings*6.)*.17;
    // Looped drift: two half-period-offset layers crossfade so the lace keeps
    // flowing forever instead of fading flat after a few minutes.
    float s1=fract(t*.03), s2=fract(s1+.5);
    col+=filigree(fold,depth,t,5.*s1-1.5)*(1.-abs(2.*s1-1.));
    col+=filigree(fold,depth,t,5.*s2-1.5)*(1.-abs(2.*s2-1.));
    float braid=abs(sin(twist*5.+z*1.8)*cos(twist*3.-z*.9));
    col+=palette(fold+z*.07+.4)*exp(-braid*45.)*.24;
    col*=smoothstep(.015,.23,r);
    col+=palette(t*.07+.55)*exp(-r*9.)*.38;
    col*=1.-.28*smoothstep(.5,1.9,r);
    col=1.-exp(-col*1.35);
    fragColor=vec4(col,1.);
}

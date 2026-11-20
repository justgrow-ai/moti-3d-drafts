export const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
export const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime, uFov; uniform int uShape;
uniform vec3 uCamPos, uCamTgt, uLight;
uniform vec3 uCol, uCol2, uInk, uBg0, uBg1, uBlush;
uniform vec3 uSq; uniform float uHop, uBodyScale, uWob; uniform vec3 uTilt;
uniform vec4 uDent; uniform vec3 uPull;
uniform vec4 uArm[14]; uniform vec2 uArmOn; uniform vec4 uArmR;
uniform vec3 uFace; uniform vec4 uStyle; uniform vec4 uExA; uniform vec4 uExB; uniform vec2 uLook; uniform float uSpread;

float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float smax(float a,float b,float k){ return -smin(-a,-b,k); }
float sdSph(vec3 p,float r){ return length(p)-r; }
float sdEll(vec3 p,vec3 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.)/k1; }
float sdRBox(vec3 p,vec3 b,float r){ vec3 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
float sdCapR(vec3 p,vec3 a,vec3 b,float ra,float rb){ vec3 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-mix(ra,rb,h); }
float sdRCone(vec3 p,float r1,float r2,float h){ vec2 q=vec2(length(p.xz),p.y); float b=(r1-r2)/h; float a=sqrt(1.-b*b); float k=dot(q,vec2(-b,a));
  if(k<0.) return length(q)-r1; if(k>a*h) return length(q-vec2(0.,h))-r2; return dot(q,vec2(a,b))-r1; }
float sdTri2(vec2 p,float r){ const float k=1.7320508; p.x=abs(p.x)-r; p.y=p.y+r/k; if(p.x+k*p.y>0.) p=vec2(p.x-k*p.y,-k*p.x-p.y)/2.; p.x-=clamp(p.x,-2.*r,0.); return -length(p)*sign(p.y); }

float body(vec3 q){
  float t=uTime, d;
  if(uShape==0){ d=smax(sdEll(q-vec3(0.,.5,0.),vec3(1.2,.62,1.05)),-q.y,.14); }
  else if(uShape==1){ d=sdSph(q-vec3(0.,.8,0.),.8); d=smin(d,sdRCone(q-vec3(0.,1.08,0.),.5,.1,.52),.32);
    d=smin(d,sdCapR(q,vec3(0.,1.62,0.),vec3(.2+.05*sin(t*2.3),1.86,0.),.1,.06),.1); d=smax(d,-q.y,.06); }
  else if(uShape==2){ d=sdRBox(q-vec3(0.,.73,0.),vec3(.74),.3); }
  else if(uShape==3){ d=sdCapR(q,vec3(-.55,.6,0.),vec3(.55,.6,0.),.6,.6); }
  else if(uShape==4){ vec3 c=q-vec3(0.,.99,0.); d=length(vec2(length(c.xy)-.6,c.z))-.38; }
  else if(uShape==5){ d=smax(sdSph(q-vec3(0.,-.06,0.),1.06),-q.y,.12); }
  else if(uShape==6){ d=sdRCone(q-vec3(0.,.04,0.),.05,.5,.62); d=smin(d,sdEll(q-vec3(0.,.8,0.),vec3(.86,.24,.86)),.14);
    d=smin(d,sdEll(q-vec3(0.,1.0,0.),vec3(.5,.26,.5)),.12); d=smin(d,sdCapR(q,vec3(0.,1.15,0.),vec3(0.,1.42,0.),.09,.075),.07); }
  else if(uShape==7){ d=smax(sdEll(q-vec3(0.,.62,0.),vec3(.8,.64,.8)),-q.y,.12); d=smin(d,sdRCone(q-vec3(0.,1.,0.),.3,.09,.4),.26);
    float s=sin(t*1.7)*.06; d=smin(d,sdCapR(q,vec3(0.,1.38,0.),vec3(.2+s,1.6,0.),.095,.055),.07); }
  else if(uShape==8){ vec3 h=q-vec3(0.,1.42,0.); h.x+=.04*sin(t*1.6); d=smin(sdSph(q-vec3(0.,.6,0.),.62),sdSph(h,.44),.12); d=smax(d,-q.y,.08); }
  else if(uShape==9){ vec3 c=q*vec3(1.,1.,1.15); d=sdSph(c-vec3(0.,.62,0.),.62); d=smin(d,sdSph(c-vec3(-.58,.44,0.),.44),.22);
    d=smin(d,sdSph(c-vec3(.6,.42,0.),.42),.22); d=smin(d,sdSph(c-vec3(-.28,.98,0.),.38),.22); d=smin(d,sdSph(c-vec3(.32,.92,0.),.34),.22);
    d=smax(d/1.08,-q.y,.12); }
  else if(uShape==10){ float d2=sdTri2(q.xy-vec2(0.,.7),.62)-.3; vec2 w=vec2(d2,abs(q.z)-.16); d=min(max(w.x,w.y),0.)+length(max(w,0.))-.24; d=smax(d,-q.y,.05); }
  else if(uShape==11){ d=1e3; for(int i=0;i<4;i++){ float fi=float(i); float r=.28+fi*.09; float x=-1.12+fi*.5+fi*fi*.02; float y=r+.06*max(0.,sin(t*3.2-fi*1.1)); d=smin(d,sdSph(q-vec3(x,y,0.),r),.14);} }
  else if(uShape==12){ d=sdSph(q-vec3(0.,.92,0.),.62); float a=atan(q.z,q.x); float rr=1.+.1*sin(a*5.+.6)+.05*sin(a*9.+t*.6);
    float pd=smax(sdEll(q-vec3(0.,.05,0.),vec3(.8*rr,.13,.76*rr)),-q.y,.05); d=smin(d,pd,.5); }
  else if(uShape==13){ vec3 c=q-vec3(0.,.98,0.); c.xz/=(1.-.12*c.y); d=sdEll(c,vec3(.7,.98,.7))*.92; d=smax(d,-q.y,.05); }
  else if(uShape==14){ d=sdEll(q-vec3(0.,.6,0.),vec3(.68,.6,.62)); float w1=sin(t*6.)*.12, w2=sin(t*6.-1.3)*.18;
    vec3 p0=vec3(.42,.55,-.25), p1=vec3(.95,.6+w1*.5,-.5+w1), p2=vec3(1.4,.72+w2*.4,-.62+w2);
    d=smin(d,sdCapR(q,p0,p1,.24,.14),.18); d=smin(d,sdCapR(q,p1,p2,.14,.04),.08); d=smax(d,-q.y,.05); }
  else { d=sdRBox(q-vec3(0.,.55,0.),vec3(.72,.55,.34),.16); d=smin(d,sdEll(q-vec3(-.36,1.06,0.),vec3(.47,.37,.34)),.1); d=smin(d,sdEll(q-vec3(.36,1.06,0.),vec3(.47,.37,.34)),.1); }
  return d;
}
float arms(vec3 p){
  float d=1e3;
  for(int a=0;a<2;a++){ if(uArmOn[a]<.001) continue;
    float best=1e3, bt=0.;
    for(int i=0;i<6;i++){ vec3 A=uArm[a*7+i].xyz, B=uArm[a*7+i+1].xyz; vec3 pa=p-A, ba=B-A; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);
      float dd=length(pa-ba*h); if(dd<best){ best=dd; bt=(float(i)+h)/6.; } }
    vec2 R=a==0?uArmR.xy:uArmR.zw;
    float r=mix(R.x,R.y,smoothstep(0.,.75,bt));
    float da=best-r;
    vec4 T=uArm[a*7+6]; da=smin(da,sdSph(p-T.xyz,T.w),.1); d=min(d,da); }
  return d;
}
mat3 rotXZ(vec3 a){ float cx=cos(a.x),sx=sin(a.x),cz=cos(a.z),sz=sin(a.z),cy=cos(a.y),sy=sin(a.y);
  return mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy)*mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx)*mat3(cz,sz,0., -sz,cz,0., 0.,0.,1.); }
vec3 toLocal(vec3 p){ vec3 q=p-vec3(0.,uHop,0.); q=rotXZ(uTilt)*q; return q; }
vec3 toBody(vec3 q){ vec3 s=q/(uSq*uBodyScale); float pl=length(uPull);
  if(pl>1e-4){ vec3 v=s-vec3(0.,.7,0.); float w=smoothstep(.0,1.,dot(normalize(v),uPull/pl))*smoothstep(2.6,.4,length(v)); s-=uPull*w; }
  return s; }
vec2 map(vec3 p){
  vec3 q=toLocal(p); vec3 s=toBody(q);
  float db=body(s)*min(min(uSq.x,uSq.y),uSq.z)*uBodyScale;
  db+=uDent.w*exp(-dot(s-uDent.xyz,s-uDent.xyz)*5.);
  db+=uWob*sin(s.x*5.+uTime*7.)*sin(s.y*4.3-uTime*6.)*sin(s.z*5.1+uTime*5.);
  float da=arms(q);
  float d=smin(db,da,.2);
  return vec2(d, clamp(.5+.5*(db-da)/.12,0.,1.));
}
vec3 calcN(vec3 p){ const vec2 e=vec2(.0015,-.0015);
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x); }
float softShadow(vec3 ro,vec3 rd){ float res=1., t=.03;
  for(int i=0;i<28;i++){ float h=map(ro+rd*t).x; res=min(res,9.*h/t); t+=clamp(h,.03,.25); if(res<.002||t>4.5) break; }
  return clamp(res,0.,1.); }
float calcAO(vec3 p,vec3 n){ float o=0., s=1.; for(int i=0;i<5;i++){ float h=.02+.11*float(i); o+=(h-map(p+n*h).x)*s; s*=.75; } return clamp(1.-1.6*o,0.,1.); }

// ---------- face (2D, painted on the surface) ----------
float sdSeg(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdEl2(vec2 p,vec2 r){ return (length(p/r)-1.)*min(r.x,r.y); }
float arcUp(vec2 p,float r,float w){ p.x=abs(p.x); if(p.y<0.) return length(p-vec2(r,0.))-w; return abs(length(p)-r)-w; }
float arcDn(vec2 p,float r,float w){ return arcUp(vec2(p.x,-p.y),r,w); }
float eyeBase(vec2 e,int s){
  if(s==0) return length(e)-.068;
  if(s==1) return sdEl2(e,vec2(.05,.088));
  if(s==2) return length(e)-.082;
  if(s==3) return sdSeg(e,vec2(-.06,0.),vec2(.06,0.))-.017;
  if(s==4) return length(e)-.105;
  if(s==5) return sdEl2(e,vec2(.085,.052));
  if(s==6) return arcUp(e+vec2(0.,.028),.064,.016);
  if(s==7){ vec2 q=abs(e)-vec2(.05,.058)+.02; return length(max(q,0.))+min(max(q.x,q.y),0.)-.02; }
  if(s==8) return length(e)-.042;
  return max(length(e)-.078,e.y-.012);
}
float eyeD(vec2 e,float side){
  int s=int(uStyle.x+.5); float o=max(1.-uExB.z,.07);
  float d=eyeBase(vec2(e.x,e.y/o),s)*o;
  float closed=sdSeg(e,vec2(-.058,0.),vec2(.058,0.))-.016;
  if(s!=3&&s!=6) d=mix(closed,d,smoothstep(0.,.45,o));
  float dh=arcUp(e+vec2(0.,.028),.066,.017);
  float ds=sdEl2(e,vec2(.095,.11));
  vec2 c=vec2(e.x*side,e.y); float dq=min(sdSeg(c,vec2(-.045,.045),vec2(.035,0.)),sdSeg(c,vec2(-.045,-.045),vec2(.035,0.)))-.016;
  float dl=sdSeg(e+vec2(0.,.012),vec2(-.062,0.),vec2(.062,0.))-.015;
  float r=length(e), a=atan(e.y,e.x); float dz=max(abs(fract(r/.036-a*.159+uTime*1.5)-.5)*.036-.008, r-.095);
  d=mix(d,dh,uExA.x); d=mix(d,ds,uExA.y); d=mix(d,dq,uExA.z); d=mix(d,dl,uExA.w); d=mix(d,dz,uExB.x);
  return d;
}
float glintD(vec2 e){ int s=int(uStyle.x+.5); float g=(s==2||s==4)?1.:0.; g=max(g,uExA.y); g*=(1.-uExA.x)*(1.-uExA.z)*(1.-uExA.w)*(1.-uExB.x)*step(uExB.z,.4);
  float r=(s==4?.03:.024)*mix(1.,1.15,uExA.y); return g>.5 ? length(e-vec2(.026,.032)*(s==4?1.25:1.))-r : 1.; }
float mouthD(vec2 m){
  int s=int(uStyle.y+.5); float d=length(m)+.006;
  if(s==1) d=sdSeg(m,vec2(-.04,0.),vec2(.04,0.))-.012;
  else if(s==2) d=length(m)-.022;
  else if(s==3){ vec2 q=vec2(abs(m.x)-.03,m.y); d=arcDn(q-vec2(0.,.01),.03,.011); }
  else if(s==4) d=arcDn(m-vec2(0.,.03),.045,.012);
  else if(s==5) d=abs(length(m)-.026)-.01;
  else if(s==6) d=max(length(m-vec2(0.,.012))-.052,m.y-.012);
  float dh=max(length(m-vec2(0.,.016))-.062,m.y-.016);
  float ds=sdEl2(m+vec2(0.,.006),vec2(.032,.044));
  float dw=max(abs(m.y-.011*sin(m.x*95.))-.01,abs(m.x)-.05);
  float dl=length(m)-.018;
  float dwo=max(abs(m.y+.004-.008*sin(m.x*70.+1.))-.009,abs(m.x)-.04);
  d=mix(d,dh,uExA.x); d=mix(d,ds,uExA.y); d=mix(d,dw,uExA.z); d=mix(d,dl,uExA.w); d=mix(d,dw,uExB.x); d=mix(d,dwo,uExB.y*(1.-uExA.x));
  return d;
}
float browD(vec2 b,float side){
  int s=int(uStyle.z+.5); if(s==0) return 1.;
  float raise=.025*uExA.x+.055*uExA.y-.03*uExA.z-.03*uExA.w+.015*uExB.y;
  float tilt=(.55*uExA.z-.5*uExB.y)*side; if(s==2) tilt-=.32*side;
  b.y-=raise; float cs=cos(tilt), sn=sin(tilt); b=mat2(cs,-sn,sn,cs)*b;
  if(s==1||s==2) return sdSeg(b,vec2(-.045,0.),vec2(.045,0.))-.012;
  if(s==3) return sdEl2(b-vec2(0.,.015),vec2(.028,.019));
  return arcUp(b+vec2(0.,.02),.042,.011);
}
vec4 face(vec2 uv){ // returns ink coverage in a (rgb unused), plus glint in .r, blush in .g
  float sp=uSpread; vec2 lk=uLook*vec2(.07,.05);
  vec2 el=uv-vec2(-sp,0.)-lk, er=uv-vec2(sp,0.)-lk;
  float d=min(eyeD(el,-1.),eyeD(er,1.));
  float dg=min(glintD(el),glintD(er));
  float my=-.17-.01*uExA.x; d=min(d,mouthD(uv-vec2(0.,my)-lk*.6));
  float by=.135; d=min(d,min(browD(uv-vec2(-sp,by)-lk,-1.),browD(uv-vec2(sp,by)-lk,1.)));
  float bl=uStyle.w>.5||uExA.x>.3 ? max(uStyle.w,uExA.x*.8) : 0.;
  float db=min(length((uv-vec2(-sp-.1,-.09)-lk*.6)/vec2(1.,.6)),length((uv-vec2(sp+.1,-.09)-lk*.6)/vec2(1.,.6)));
  return vec4(d,dg,bl*smoothstep(.085,.0,db),0.);
}
vec3 albedo(vec3 s,vec3 n,float m){
  vec3 c=uCol;
  if(uShape==3) c=mix(uCol2,uCol,smoothstep(-.012,.012,s.x));
  else if(uShape==4){ vec3 cc=s-vec3(0.,.99,0.); float a=atan(cc.y,cc.x); float edge=cc.y+.12+.07*sin(a*7.)+.03*sin(a*13.); c=mix(uCol,uCol2,smoothstep(-.02,.02,edge)*step(-.2,cc.z)); }
  else if(uShape==10){ float band=smoothstep(.47,.45,s.y)*smoothstep(.37,.35,abs(s.x)); c=mix(uCol,uCol2,band); }
  else if(uShape==6){ c=mix(uCol,uCol2,smoothstep(.07,.05,abs(s.y-.8))); }
  else if(uShape==15){ c=mix(uCol2,uCol,smoothstep(.55,.85,abs(n.z))); }
  return c;
}
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
void main(){
  vec2 fc=vUv*uRes; vec2 p=(2.*fc-uRes)/uRes.y;
  vec3 ro=uCamPos, ww=normalize(uCamTgt-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  float tf=tan(radians(uFov)*.5); vec3 rd=normalize(ww+(p.x*uu+p.y*vv)*tf);
  vec3 bg=lin(mix(uBg1,uBg0,smoothstep(0.,1.,vUv.y)));
  vec3 L=normalize(uLight);
  // bounding sphere for the character
  vec3 bc=vec3(0.,1.,0.); float br=3.2; vec3 oc=ro-bc; float bb=dot(oc,rd), cc=dot(oc,oc)-br*br, hd=bb*bb-cc;
  float t=-1.; vec2 h=vec2(1.,0.);
  if(hd>0.){ float t0=max(-bb-sqrt(hd),0.), t1=-bb+sqrt(hd); t=t0;
    for(int i=0;i<110;i++){ h=map(ro+rd*t); if(abs(h.x)<.0007*t||t>t1) break; t+=h.x*.85; }
    if(t>t1||h.x>.03) t=-1.; }
  float tg=-ro.y/rd.y; vec3 col=bg;
  if(t>0.&&(tg<0.||t<tg)){
    vec3 pos=ro+rd*t, n=calcN(pos); vec3 q=toLocal(pos), s=toBody(q);
    vec3 alb=lin(albedo(s,n,h.y));
    // face paint (front of the body only, not on arms)
    vec3 nl=rotXZ(uTilt)*n;
    float fm=smoothstep(.15,.45,nl.z)*(1.-h.y)*step(0.,s.z);
    if(fm>0.){ vec2 uv=(s.xy-uFace.xy)/uFace.z; vec4 F=face(uv); float aa=fwidth(F.x)*.9+.002;
      alb=mix(alb,lin(uBlush),F.z*.55*fm);
      alb=mix(alb,lin(uInk),(1.-smoothstep(-aa,aa,F.x))*fm);
      alb=mix(alb,vec3(1.),(1.-smoothstep(-aa,aa,F.y))*fm*.95); }
    float sh=softShadow(pos+n*.01,L), ao=calcAO(pos,n);
    float dif=clamp(dot(n,L)*.6+.4,0.,1.); dif=pow(dif,1.6);            // soft wrap = clay
    float sky=.55+.45*n.y, bou=clamp(-n.y,0.,1.)*.25;
    float rim=pow(1.-clamp(dot(n,-rd),0.,1.),3.)*.22;
    vec3 lightc=vec3(1.,.97,.93)*1.05*dif*mix(.45,1.,sh) + vec3(.9,.93,1.)*.55*sky*ao + lin(uBg1)*bou*ao;
    col=alb*lightc*mix(.75,1.,ao) + rim*ao*lin(uBg0);
    col=mix(col,bg,smoothstep(14.,22.,t));
  } else if(tg>0.){
    vec3 pos=ro+rd*tg; float sh=1.;
    if(length(pos.xz)<4.) sh=softShadow(pos+vec3(0.,.01,0.),L);
    float ao=1.; if(length(pos.xz)<3.){ float dd=map(pos+vec3(0.,.05,0.)).x; ao=clamp(.35+dd*1.6,0.,1.); ao=mix(1.,ao,smoothstep(1.2,0.,dd)); }
    vec3 gc=lin(uBg1)*1.02; col=gc*mix(.62,1.,sh)*mix(.55,1.,ao);
    col=mix(col,bg,smoothstep(3.,9.,length(pos.xz))*.9+.1*smoothstep(0.,1.,0.));
  }
  float lu=dot(col,vec3(.299,.587,.114)); col=mix(col,vec3(lu),.12); col=col*.96+.02; col=col/(1.+col*.12); col=pow(col,vec3(1./2.2));
  col+=(fract(sin(dot(fc,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

// ESO/S. Brunier, eso0932a. See public/data/LICENSE-milky-way.md.
// The panorama's axes differ slightly from the canonical Galactic frame.
// This rotation registers it against 13 bright catalogue stars; measured
// landmark positions and residuals are in src/assets/milky-way-registration.json.
const photoRotation=[
 [-.001059815677,-.891002661138,-.453996844302],
 [.479554000032,-.398840846808,.781635426507],
 [-.877511730887,-.216887613208,.427706587969],
];
const radians=Math.PI/180;
const photoOpacity=.45;
const toPhoto=(ra,dec)=>{
 const a=ra*radians,d=dec*radians,v=[Math.cos(a)*Math.cos(d),Math.sin(a)*Math.cos(d),Math.sin(d)];
 return photoRotation.map(row=>row.reduce((sum,n,i)=>sum+n*v[i],0));
};
export function photoCoordinates(ra,dec){
 const [x,y,z]=toPhoto(ra,dec);
 return {u:((.5-Math.atan2(y,x)/(2*Math.PI))%1+1)%1,v:.5-Math.atan2(z,Math.hypot(x,y))/Math.PI};
}
export function photoCamera(view,frame){
 const direction=(ra,dec)=>{const eq=frame.toEquatorial(ra,dec);return toPhoto(eq.ra,eq.dec);};
 return {
  forward:direction(view.ra,view.dec),
  east:direction(view.ra+90,0),
  north:direction(view.ra,view.dec+90),
 };
}

function createGpuSky(image){
 const buffer=document.createElement('canvas');
 const gl=buffer.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl)return null;
 const shader=(type,source)=>{
  const result=gl.createShader(type);gl.shaderSource(result,source);gl.compileShader(result);
  if(!gl.getShaderParameter(result,gl.COMPILE_STATUS))throw Error('Sky shader unavailable');
  return result;
 };
 const vertex=shader(gl.VERTEX_SHADER,`#version 300 es
  in vec2 position;
  out vec2 screen;
  void main(){screen=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`);
 const fragment=shader(gl.FRAGMENT_SHADER,`#version 300 es
  precision highp float;
  uniform sampler2D panorama;
  uniform vec3 forward,east,north;
  uniform vec2 size;
  uniform float focal;
  in vec2 screen;
  out vec4 color;
  void main(){
   vec3 ray=forward+(0.5-screen.x)*size.x/focal*east+(screen.y-0.5)*size.y/focal*north;
   vec2 uv=vec2(fract(0.5-atan(ray.y,ray.x)/6.28318530718),0.5-atan(ray.z,length(ray.xy))/3.14159265359);
   color=texture(panorama,uv);
  }`);
 const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Sky shader unavailable');
 gl.useProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
 const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 const limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 let textureImage=image;
 if(image.naturalWidth>limit||image.naturalHeight>limit){
  const scale=Math.min(limit/image.naturalWidth,limit/image.naturalHeight);
  textureImage=document.createElement('canvas');textureImage.width=Math.floor(image.naturalWidth*scale);textureImage.height=Math.floor(image.naturalHeight*scale);
  textureImage.getContext('2d').drawImage(image,0,0,textureImage.width,textureImage.height);
 }
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,textureImage);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.generateMipmap(gl.TEXTURE_2D);
 const uniforms=Object.fromEntries(['forward','east','north','size','focal'].map(name=>[name,gl.getUniformLocation(program,name)]));
 let last=null,lastFrame=null;
 return {
  draw(ctx,view,frame,width,height){
   if(gl.isContextLost())return false;
   const bw=ctx.canvas.width,bh=ctx.canvas.height,key=[view.ra,view.dec,view.fov,bw,bh].join(',');
   if(key!==last||frame!==lastFrame){
    if(buffer.width!==bw||buffer.height!==bh){buffer.width=bw;buffer.height=bh;gl.viewport(0,0,bw,bh);}
    const camera=photoCamera(view,frame);
    for(const name of ['forward','east','north'])gl.uniform3fv(uniforms[name],camera[name]);
    gl.uniform2f(uniforms.size,width,height);gl.uniform1f(uniforms.focal,Math.min(width,height)/(2*Math.tan(view.fov*radians/2)));
    gl.drawArrays(gl.TRIANGLES,0,3);last=key;lastFrame=frame;
   }
   ctx.save();ctx.globalAlpha=photoOpacity;ctx.drawImage(buffer,0,0,width,height);ctx.restore();return true;
  },
 };
}

function createSoftwareSky(image){
 const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
 const sourceContext=source.getContext('2d',{willReadFrequently:true});sourceContext.drawImage(image,0,0);
 const {data:pixels}=sourceContext.getImageData(0,0,source.width,source.height);
 const buffer=document.createElement('canvas'),paint=buffer.getContext('2d');
 let last=null,lastFrame=null,output;
 return {
  draw(ctx,view,frame,width,height){
   if(!width||!height)return;
   const key=[view.ra,view.dec,view.fov,width,height].join(',');
   if(key!==last||frame!==lastFrame){
    // Reproject a soft, inexpensive image; catalogue stars stay full resolution.
    const scale=Math.min(1,480/width,320/height),bw=Math.max(1,Math.round(width*scale)),bh=Math.max(1,Math.round(height*scale));
    if(!output||buffer.width!==bw||buffer.height!==bh){buffer.width=bw;buffer.height=bh;output=paint.createImageData(bw,bh);}
    const {forward,east,north}=photoCamera(view,frame),focal=Math.min(width,height)/(2*Math.tan(view.fov*radians/2));
    const data=output.data,sw=source.width,sh=source.height;
    for(let y=0;y<bh;y++){
     const sy=(height/2-(y+.5)*height/bh)/focal;
     for(let x=0;x<bw;x++){
      const sx=(width/2-(x+.5)*width/bw)/focal;
      const gx=forward[0]+sx*east[0]+sy*north[0],gy=forward[1]+sx*east[1]+sy*north[1],gz=forward[2]+sx*east[2]+sy*north[2];
      const u=((.5-Math.atan2(gy,gx)/(2*Math.PI))%1+1)%1;
      const v=.5-Math.atan2(gz,Math.hypot(gx,gy))/Math.PI;
      const tx=u*sw-.5,ty=Math.max(0,Math.min(sh-1,v*sh-.5)),ix=Math.floor(tx),iy=Math.floor(ty),fx=tx-ix,fy=ty-iy;
      const x0=(ix+sw)%sw,x1=(x0+1)%sw,y1=Math.min(iy+1,sh-1);
      const a=(iy*sw+x0)*4,b=(iy*sw+x1)*4,c=(y1*sw+x0)*4,d=(y1*sw+x1)*4,index=(y*bw+x)*4;
      for(let channel=0;channel<3;channel++)data[index+channel]=(pixels[a+channel]*(1-fx)+pixels[b+channel]*fx)*(1-fy)+(pixels[c+channel]*(1-fx)+pixels[d+channel]*fx)*fy;
      data[index+3]=255;
     }
    }
    paint.putImageData(output,0,0);last=key;lastFrame=frame;
   }
   ctx.save();ctx.globalAlpha=photoOpacity;ctx.drawImage(buffer,0,0,width,height);ctx.restore();
  },
 };
}

export async function loadPhotographicSky(url){
 const image=new Image();image.src=url;await image.decode();
 let gpu,software;
 try{gpu=createGpuSky(image);}catch{}
 return {
  draw(ctx,view,frame,width,height){
   if(!width||!height)return;
   if(gpu?.draw(ctx,view,frame,width,height))return;
   software??=createSoftwareSky(image);software.draw(ctx,view,frame,width,height);
  },
 };
}

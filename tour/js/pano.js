/* Star View Room 360 viewer: dependency-free WebGL equirectangular viewer. */
(function(){
  var cv=document.getElementById('pano'), wrap=document.getElementById('pano-wrap');
  var fallback=document.getElementById('pano-fallback');
  var gl=cv && (cv.getContext('webgl')||cv.getContext('experimental-webgl'));
  if(!gl){ if(fallback) fallback.hidden=false; if(cv) cv.hidden=true; return; }
  var hp=gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  var prec=(hp&&hp.precision>0)?'highp':'mediump';
  var vs='attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
  var fs='precision '+prec+' float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,tf,asp;'+
    'void main(){vec3 d=normalize(vec3(v.x*tf*asp,v.y*tf,1.));'+
    'float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);'+
    'float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);'+
    'float lon=atan(d.x,d.z),lat=asin(clamp(d.y,-1.,1.));'+
    'vec2 uv=vec2(fract(lon/6.2831853+.5),.5-lat/3.1415927);gl_FragColor=texture2D(t,uv);}';
  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
  var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var U={yaw:gl.getUniformLocation(pr,'yaw'),pitch:gl.getUniformLocation(pr,'pitch'),tf:gl.getUniformLocation(pr,'tf'),asp:gl.getUniformLocation(pr,'asp')};
  var tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(function(k){gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);});
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  var st={yaw:0,pitch:0,fov:85,vy:0,vp:0,loaded:false,drag:false};
  var maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  function resize(){var r=wrap.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);gl.viewport(0,0,cv.width,cv.height);draw();}
  function draw(){if(!st.loaded)return;gl.uniform1f(U.yaw,st.yaw);gl.uniform1f(U.pitch,st.pitch);gl.uniform1f(U.tf,Math.tan(st.fov*Math.PI/360));gl.uniform1f(U.asp,cv.width/cv.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  var cache={};
  function getImg(src,cb){if(cache[src]&&cache[src].complete){cb(cache[src]);return;}var im=cache[src]||new Image();cache[src]=im;im.onload=function(){cb(im);};if(!im.src)im.src=src;}
  function upload(im){var src=im;if(im.width>maxTex){var c=document.createElement('canvas');c.width=maxTex;c.height=maxTex/2;c.getContext('2d').drawImage(im,0,0,c.width,c.height);src=c;}
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,src);st.loaded=true;draw();}
  var scenes=window.TOUR_SCENES||[], btns=document.querySelectorAll('[data-scene]'), cap=document.getElementById('pano-caption'), loading=document.getElementById('pano-loading');
  function show(i){var s=scenes[i];if(!s)return;btns.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.scene==i?'true':'false');});
    if(cap)cap.textContent=s.note;if(loading)loading.hidden=false;
    getImg(s.src,function(im){upload(im);st.yaw=s.yaw*Math.PI/180;st.pitch=0;st.fov=85;draw();if(loading)loading.hidden=true;
      var n=scenes[(i+1)%scenes.length];if(n)getImg(n.src,function(){});});}
  btns.forEach(function(b){b.addEventListener('click',function(){show(+b.dataset.scene);});});
  var lx,ly,lt;
  function down(x,y){st.drag=true;lx=x;ly=y;lt=performance.now();st.vy=st.vp=0;cv.classList.add('grabbing');}
  function move(x,y){if(!st.drag)return;var k=st.fov/cv.clientHeight*Math.PI/180;var dy=(x-lx)*k,dp=(y-ly)*k;st.yaw-=dy;st.pitch=Math.max(-1.48,Math.min(1.48,st.pitch+dp));
    var now=performance.now(),dt=Math.max(1,now-lt);st.vy=-dy/dt*16;st.vp=dp/dt*16;lx=x;ly=y;lt=now;draw();}
  function up(){st.drag=false;cv.classList.remove('grabbing');requestAnimationFrame(coast);}
  function coast(){if(st.drag)return;st.vy*=.92;st.vp*=.92;if(Math.abs(st.vy)+Math.abs(st.vp)<1e-4)return;st.yaw+=st.vy;st.pitch=Math.max(-1.48,Math.min(1.48,st.pitch+st.vp));draw();requestAnimationFrame(coast);}
  cv.addEventListener('mousedown',function(e){down(e.clientX,e.clientY);});
  window.addEventListener('mousemove',function(e){move(e.clientX,e.clientY);});
  window.addEventListener('mouseup',up);
  var pinch=0;
  cv.addEventListener('touchstart',function(e){if(e.touches.length===1)down(e.touches[0].clientX,e.touches[0].clientY);else if(e.touches.length===2){st.drag=false;pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
  cv.addEventListener('touchmove',function(e){if(e.touches.length===1)move(e.touches[0].clientX,e.touches[0].clientY);else if(e.touches.length===2){var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);zoom((pinch-d)*.15);pinch=d;}e.preventDefault();},{passive:false});
  cv.addEventListener('touchend',up);
  function zoom(d){st.fov=Math.max(38,Math.min(100,st.fov+d));draw();}
  cv.addEventListener('wheel',function(e){e.preventDefault();zoom(e.deltaY*.05);},{passive:false});
  cv.addEventListener('keydown',function(e){var k=e.key,s=.08;if(k==='ArrowLeft')st.yaw-=s;else if(k==='ArrowRight')st.yaw+=s;else if(k==='ArrowUp')st.pitch=Math.min(1.48,st.pitch+s);else if(k==='ArrowDown')st.pitch=Math.max(-1.48,st.pitch-s);else if(k==='+'||k==='=')zoom(-5);else if(k==='-')zoom(5);else return;e.preventDefault();draw();});
  var fsb=document.getElementById('pano-full');
  if(fsb)fsb.addEventListener('click',function(){var el=wrap;if(document.fullscreenElement)document.exitFullscreen();else if(el.requestFullscreen)el.requestFullscreen();else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();});
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  resize();show(0);
})();

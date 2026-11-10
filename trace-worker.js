// A small browser study of the sphere scene in ErayGulerler/RayTracingProject_Csharp.
// Each sample follows a jittered camera ray through at most eight material bounces.
// The page runs several copies of this worker. Each message asks for one pass over
// the picture, and the page adds the passes together.
function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeScene(roughness) {
  const random = randomGenerator(1978);
  const spheres = [];
  function add(x, y, z, radius, material, colour, fuzz = 0) {
    spheres.push({x, y, z, radius, material, colour, fuzz});
  }
  add(0, -1000, 0, 1000, 'matte', [.47,.49,.46]);
  add(-2.35, 1, 0, 1, 'matte', [.6,.23,.13]);
  add(0, 1, 0, 1, 'glass', [1,1,1]);
  add(2.35, 1, 0, 1, 'metal', [.92,.89,.83], roughness);
  for (let row = -4; row <= 3; row++) {
    for (let column = -5; column <= 5; column++) {
      const x = column * 1.1 + random() * .55;
      const z = row * 1.12 + random() * .55;
      if (Math.abs(z) < 1.2 && Math.abs(x) < 3.7) continue;
      const radius = .17 + random() * .17;
      const colour = [.1 + .8 * random(), .1 + .8 * random(), .1 + .8 * random()];
      add(x, radius, z, radius, random() < .2 ? 'metal' : 'matte', colour, .12);
    }
  }
  return spheres;
}

function trace(scene, random, ox, oy, oz, dx, dy, dz) {
  let red=1, green=1, blue=1;
  for (let depth=0; depth<8; depth++) {
    const invLength = 1 / Math.hypot(dx,dy,dz);
    dx *= invLength; dy *= invLength; dz *= invLength;
    let near=Infinity, hit=null;
    for (const s of scene) {
      const x=s.x-ox, y=s.y-oy, z=s.z-oz;
      const along=x*dx+y*dy+z*dz;
      const discriminant=along*along-(x*x+y*y+z*z-s.radius*s.radius);
      if (discriminant < 0) continue;
      const root=Math.sqrt(discriminant);
      let t=along-root;
      if (t < .001) t=along+root;
      if (t > .001 && t < near) { near=t; hit=s; }
    }
    if (!hit) {
      const sky=.5*(dy+1);
      return [red*(1-.48*sky), green*(1-.29*sky), blue*(1-.04*sky)];
    }
    ox+=dx*near; oy+=dy*near; oz+=dz*near;
    let nx=(ox-hit.x)/hit.radius, ny=(oy-hit.y)/hit.radius, nz=(oz-hit.z)/hit.radius;
    const dot=dx*nx+dy*ny+dz*nz;
    const entering=dot<0;
    if (!entering) { nx=-nx; ny=-ny; nz=-nz; }
    const cosine=Math.min(Math.abs(dot),1);
    const rx=dx+2*cosine*nx, ry=dy+2*cosine*ny, rz=dz+2*cosine*nz;
    red*=hit.colour[0]; green*=hit.colour[1]; blue*=hit.colour[2];
    if (hit.material === 'glass') {
      const ratio=entering ? 1/1.5 : 1.5;
      const k=1-ratio*ratio*(1-cosine*cosine);
      if (k<0 || random()<.04+.96*(1-cosine)**5) { dx=rx;dy=ry;dz=rz; }
      else {
        const offset=ratio*cosine-Math.sqrt(k);
        dx=ratio*dx+offset*nx;dy=ratio*dy+offset*ny;dz=ratio*dz+offset*nz;
      }
    } else {
      const phi=2*Math.PI*random(), h=2*random()-1, r=Math.sqrt(1-h*h);
      const ux=r*Math.cos(phi), uy=h, uz=r*Math.sin(phi);
      if (hit.material==='matte') { dx=nx+ux; dy=ny+uy; dz=nz+uz; }
      else {
        const spread=hit.fuzz*Math.cbrt(random());
        dx=rx+spread*ux; dy=ry+spread*uy; dz=rz+spread*uz;
        if (dx*nx+dy*ny+dz*nz<=0) break;
      }
    }
  }
  return [0,0,0];
}

let scene, sceneRoughness;

self.onmessage = ({data:{job,width,height,angle,eyeY,roughness,seed}}) => {
  if (roughness !== sceneRoughness) { scene=makeScene(roughness); sceneRoughness=roughness; }
  const random=randomGenerator(seed);
  const yaw=angle*Math.PI/180, sin=Math.sin(yaw), cos=Math.cos(yaw);
  const radius=8.8, targetY=.65;
  const length=Math.hypot(radius,eyeY-targetY);
  const tilt=(eyeY-targetY)/length, forward=radius/length;
  const zoom=Math.tan(25*Math.PI/360);
  const sums=new Float32Array(width*height*3);
  for (let y=0; y<height; y++) {
    for (let x=0; x<width; x++) {
      const u=(2*(x+random())/width-1)*zoom*width/height;
      const v=(1-2*(y+random())/height)*zoom;
      const rgb=trace(scene,random,radius*sin,eyeY,radius*cos,
        -sin*forward+cos*u-sin*tilt*v,-tilt+forward*v,-cos*forward-sin*u-cos*tilt*v);
      const j=(y*width+x)*3;
      sums[j]=rgb[0]; sums[j+1]=rgb[1]; sums[j+2]=rgb[2];
    }
  }
  self.postMessage({job,sums},[sums.buffer]);
};

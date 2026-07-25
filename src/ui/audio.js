import {save} from '../core/state.js';

let AC=null;
function ac(){if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();return AC}
function tone(f0,f1,dur,type,vol){
  if(save.muted)return;
  try{const a=ac(),t=a.currentTime,o=a.createOscillator(),g=a.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(1e-4,t+dur);
    o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+.02)}catch(e){}
}
export const sfx={
  ui(){tone(440,660,.06,'square',.03)},
  roll(){tone(200,800,.3,'triangle',.06)},
  leg(){tone(392,784,.4,'square',.08);setTimeout(()=>tone(523,1046,.5,'square',.07),160)},
  level(){tone(330,660,.12,'square',.05);setTimeout(()=>tone(660,990,.18,'square',.05),120)},
  forge(){tone(180,70,.2,'square',.07)},
  coin(){tone(900,1400,.08,'triangle',.04)},
  death(){tone(150,40,.5,'sawtooth',.08)},
  win(){tone(523,523,.15,'square',.06);setTimeout(()=>tone(659,659,.15,'square',.06),150);
    setTimeout(()=>tone(784,1568,.4,'square',.07),300)},
};


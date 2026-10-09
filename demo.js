const $=id=>document.getElementById(id);
const controlIds=['wave','master','filterType','svfMode','cutoff','res','amount','fAttack','fDecay','fSustain','fRelease','aAttack','aDecay','aSustain','aRelease','lfoShape','lfoRate','lfoAmount','lfoDestination'];
const value=id=>+$(id).value;
const defaults=Object.fromEntries(controlIds.map(id=>[id,$(id).value]));
const cutoffHz=()=>80*Math.pow(9000/80,value('cutoff')/100);
function readPatch(frequency=130.8128){
 const choice=$('filterType').value,response=choice==='svf'?$('svfMode').value:choice;
 const envelope=prefix=>({attack:value(prefix+'Attack'),decay:value(prefix+'Decay'),sustain:value(prefix+'Sustain')/100,release:value(prefix+'Release')});
 return {frequency,wave:$('wave').value,cutoff:cutoffHz(),amount:value('amount'),resonance:value('res')/85,model:choice==='ladder'?3:response==='highpass'?2:response==='bandpass'?1:0,amp:envelope('a'),filterEnv:envelope('f'),lfoShape:$('lfoShape').value,lfoRate:value('lfoRate'),lfoAmount:value('lfoAmount'),lfoDestination:$('lfoDestination').value};
}
let audio=null,master=null,limiter=null,ready=null,active=null,lastVoice=null,requestId=0,pending=null;
async function initAudio(){
 audio ||= new (window.AudioContext||window.webkitAudioContext)();
 if(audio.state!=='running')await audio.resume();
 if(!ready){
   master=audio.createGain();master.gain.value=value('master')/100;
   limiter=audio.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.1;
   master.connect(limiter);limiter.connect(audio.destination);
   ready=audio.audioWorklet.addModule('synth-worklet.js').catch(error=>{master.disconnect();limiter.disconnect();master=null;limiter=null;ready=null;throw error});
 }
 await ready;
}
function noteLabel(midi){const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];return names[midi%12]+(Math.floor(midi/12)-1)}
function showKeys(){document.querySelectorAll('.key').forEach(key=>key.classList.toggle('active',active?.held&&+key.dataset.midi===active.midi||pending===+key.dataset.midi));}
function showPlay(){const held=active?.held&&active.midi===48;$('play').textContent=pending===48?'starting…':held?'↘ release C3':'▶ play C3';showKeys();}
function silenceVoice(voice){if(!voice||voice.ended)return;voice.node.port.postMessage({type:'panic'});voice.held=false;voice.panicAt=audio.currentTime;}
async function noteOn(midi){
 const run=++requestId;pending=midi;silenceVoice(active);active=null;showPlay();$('error').textContent='';$('status').textContent='starting';
 try{
   await initAudio();if(run!==requestId)return;
   const patch=readPatch(440*Math.pow(2,(midi-69)/12));
   const node=new AudioWorkletNode(audio,'synth-demo',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{patch}});
   const voice={node,midi,patch,start:audio.currentTime,held:true,releaseAt:null,ended:false,timeline:[{time:0,cycles:0,rate:patch.lfoRate}]};
   node.connect(master);active=voice;lastVoice=voice;pending=null;
   node.port.onmessage=event=>{if(event.data.type==='ended'){voice.ended=true;node.disconnect();node.port.close();if(active===voice){active=null;showPlay();}}};
   node.onprocessorerror=()=>{voice.ended=true;node.disconnect();node.port.close();if(active===voice){active=null;pending=null;showPlay();$('error').textContent='Audio stopped unexpectedly. Press Play to try again.'}};
   showPlay();$('noteName').textContent=`${noteLabel(midi)} · ${patch.frequency.toFixed(1)} Hz`;
 }catch(error){if(run!==requestId)return;pending=null;active=null;showPlay();$('status').textContent='audio unavailable';$('error').textContent='Could not start audio. Refresh this page and try again.';}
}
function noteOff(midi){
 if(pending===midi){requestId++;pending=null;showPlay();$('status').textContent='ready';return;}
 if(!active||active.midi!==midi||!active.held)return;
 active.releaseAt=Math.max(0,audio.currentTime-active.start);active.held=false;active.node.port.postMessage({type:'release'});showPlay();
}
function stopAll(){requestId++;pending=null;silenceVoice(active);active=null;lastVoice=null;showPlay();$('status').textContent='stopped';}
function phaseCycles(voice,age){if(!voice)return readPatch().lfoRate*age;const segment=voice.timeline.findLast(entry=>entry.time<=age)||voice.timeline[0];return segment.cycles+(age-segment.time)*segment.rate;}
function update(){
 $('svfOptions').hidden=$('filterType').value!=='svf';
 for(const id of controlIds){const output=$(id+'Out');if(!output)continue;output.textContent=id==='cutoff'?`${Math.round(cutoffHz())} Hz`:id==='lfoRate'?`${value(id)} Hz`:id.endsWith('Sustain')||['res','amount','lfoAmount','master'].includes(id)?`${value(id)}%`:`${value(id).toFixed(2)}s`;}
 if(master)master.gain.setTargetAtTime(value('master')/100,audio.currentTime,.02);
 if(active){
   const patch=readPatch(active.patch.frequency),age=audio.currentTime-active.start;
   if(active.patch.lfoRate!==patch.lfoRate){const cycles=phaseCycles(active,age);active.timeline.push({time:age,cycles,rate:patch.lfoRate});}
   active.patch=patch;
   active.node.port.postMessage({type:'patch',patch});
 }
}
controlIds.forEach(id=>$(id).addEventListener($(id).tagName==='SELECT'?'change':'input',update));
$('play').addEventListener('click',()=>{if(pending===48||active?.held&&active.midi===48)noteOff(48);else noteOn(48)});
$('stop').addEventListener('click',stopAll);
const presets={
 pluck:{filterType:'ladder',wave:'saw',cutoff:35,res:28,amount:72,fAttack:.01,fDecay:.28,fSustain:0,fRelease:.2,aAttack:.01,aDecay:.3,aSustain:12,aRelease:.2,lfoAmount:0},
 pad:{filterType:'svf',svfMode:'lowpass',wave:'saw',cutoff:38,res:20,amount:45,fAttack:1.2,fDecay:1,fSustain:65,fRelease:1.5,aAttack:1,aDecay:.8,aSustain:80,aRelease:1.8,lfoShape:'sine',lfoRate:.5,lfoAmount:18,lfoDestination:'cutoff'},
 pulse:{filterType:'ladder',wave:'square',cutoff:48,res:28,amount:35,fAttack:.08,fDecay:.5,fSustain:35,fRelease:.5,aAttack:.02,aDecay:.2,aSustain:85,aRelease:.4,lfoShape:'triangle',lfoRate:2,lfoAmount:75,lfoDestination:'volume'},
 vibrato:{filterType:'lowpass',wave:'sine',cutoff:65,res:0,amount:0,fAttack:.05,fDecay:.5,fSustain:50,fRelease:.5,aAttack:.2,aDecay:.4,aSustain:80,aRelease:.8,lfoShape:'sine',lfoRate:5,lfoAmount:30,lfoDestination:'pitch'},
 reset:defaults
};
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{stopAll();const patch={...defaults,...presets[button.dataset.preset]};for(const [id,val] of Object.entries(patch))$(id).value=val;update();}));
const keyboardMap={a:48,w:49,s:50,e:51,d:52,f:53,t:54,g:55,y:56,h:57,u:58,j:59,k:60};
const whiteNotes=[48,50,52,53,55,57,59,60],blackNotes=[[49,1],[51,2],[54,4],[56,5],[58,6]];
for(const [midi,position] of [...whiteNotes.map((midi,i)=>[midi,null]),...blackNotes]){
 const button=document.createElement('button');button.className='key'+(position!=null?' black':'');button.dataset.midi=midi;button.setAttribute('aria-label',`Play ${noteLabel(midi)}, hold then release`);
 let keyActivation=false;
 const shortcut=Object.keys(keyboardMap).find(key=>keyboardMap[key]===midi);button.innerHTML=`${noteLabel(midi)} <small>${shortcut.toUpperCase()}</small>`;
 if(position!=null)button.style.left=`${position/8*100-4}%`;
 button.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);noteOn(midi);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>noteOff(midi));
 // Native keyboard activation also works for assistive technology.
 button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)&&!event.repeat){event.preventDefault();keyActivation=true;noteOn(midi)}});
 button.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();noteOff(midi)}});
 button.addEventListener('click',event=>{if(keyActivation){keyActivation=false;return;}if(event.detail===0&&!active?.held&&pending==null){noteOn(midi);setTimeout(()=>noteOff(midi),450);}});
 $('keys').appendChild(button);
}
const pressed=new Set();
window.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('textarea,[contenteditable="true"],input:not([type="range"]):not([type="button"])'))return;
 const key=event.key.toLowerCase(),midi=keyboardMap[key];if(midi==null||event.repeat)return;
 event.preventDefault();pressed.add(key);noteOn(midi);
});
window.addEventListener('keyup',event=>{const key=event.key.toLowerCase();if(!pressed.has(key))return;pressed.delete(key);noteOff(keyboardMap[key]);});
// Native select menus can blur the window temporarily. Keep held notes alive there.
window.addEventListener('blur',()=>{if(document.activeElement?.tagName==='SELECT')return;pressed.clear();stopAll();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pressed.clear();stopAll();}});
window.addEventListener('pagehide',stopAll);
const stageColors=['#78baff','#ffc56d','#83cf93','#c7a0ff'];
const canvases=['filterScope','ampScope','lfoScope','response'].map(id=>$(id));
function resize(){for(const c of canvases){c.width=Math.round(c.clientWidth*devicePixelRatio);c.height=Math.round(c.clientHeight*devicePixelRatio);c.getContext('2d').setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}}
window.addEventListener('resize',resize);
function drawEnvelope(c,env,releaseAt,age,live){
 const ctx=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight,left=12,right=w-8,top=20,bottom=h-20;
 const releasePoint=releaseAt??Math.max(2.6,env.attack+env.decay+.5,live?age+.5:0),total=releasePoint+env.release+.15;
 const x=t=>left+(right-left)*t/total,y=level=>bottom-(bottom-top)*level;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle='#343636';ctx.lineWidth=1;
 for(const level of [0,.5,1]){ctx.beginPath();ctx.moveTo(left,y(level));ctx.lineTo(right,y(level));ctx.stroke()}
 const ends=[0,Math.min(env.attack,releasePoint),Math.min(env.attack+env.decay,releasePoint),releasePoint,releasePoint+env.release];
 ctx.font='10px Arial';ctx.textAlign='center';
 for(let stage=0;stage<4;stage++){
   const from=ends[stage],to=ends[stage+1];if(to<=from)continue;
   ctx.fillStyle=stageColors[stage];if(x(to)-x(from)>14)ctx.fillText('ADSR'[stage],(x(from)+x(to))/2,11);
   ctx.beginPath();for(let i=0;i<=100;i++){const t=from+(to-from)*i/100;const px=x(t),py=y(demoEnvelope(t,releasePoint,env));i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.strokeStyle=stageColors[stage];ctx.lineWidth=2;ctx.stroke();
   ctx.setLineDash([2,4]);ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(to),top);ctx.lineTo(x(to),bottom);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.textAlign='left';ctx.fillStyle='#999';ctx.fillText(live&&releaseAt==null?'held · release when you let go':'press → hold → let go',left,h-4);
 if(live){ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x(Math.min(age,total)),top);ctx.lineTo(x(Math.min(age,total)),bottom);ctx.stroke()}
}
function drawLfo(c,voice,age,patch){
 const ctx=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight,left=12,right=w-8,top=20,bottom=h-20,start=voice?Math.max(0,age-3):0,duration=3;
 const y=wave=>top+(bottom-top)*(1-wave)/2;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle='#343636';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y(0));ctx.lineTo(right,y(0));ctx.stroke();
 ctx.beginPath();for(let i=0;i<=500;i++){const time=start+duration*i/500,phase=phaseCycles(voice,time),wave=demoWave(phase,patch.lfoShape)*patch.lfoAmount/100;const x=left+(right-left)*i/500;i?ctx.lineTo(x,y(wave)):ctx.moveTo(x,y(wave))}ctx.strokeStyle='#78baff';ctx.lineWidth=2;ctx.stroke();
 ctx.font='10px Arial';ctx.fillStyle='#aaa';ctx.fillText(`${patch.lfoRate} Hz → ${patch.lfoDestination}`,left,h-4);
 if(voice){const x=left+(right-left)*Math.min(1,(age-start)/duration);ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke()}
}
function drawResponse(c,patch,cutoff){
 const ctx=c.getContext('2d'),w=c.clientWidth,h=c.clientHeight,left=12,right=w-8,top=20,bottom=h-20,sr=audio?.sampleRate||48000;
 const frequencies=Array.from({length:360},(_,i)=>20*1000**(i/359));
 const x=f=>left+(right-left)*Math.log(f/20)/Math.log(1000),y=gain=>top+(bottom-top)*(24-Math.max(-48,Math.min(24,20*Math.log10(Math.max(1e-8,gain)))))/72;
 const points=f=>frequencies.map(hz=>[x(hz),y(teachingFilterMagnitude(hz,f,patch.resonance,patch.model,sr))]);
 const base=points(patch.cutoff),peak=points(demoCutoff(patch.cutoff,patch.amount,1)),current=points(cutoff);
 const trace=list=>list.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
 ctx.clearRect(0,0,w,h);ctx.strokeStyle='#343636';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(left,y(1));ctx.lineTo(right,y(1));ctx.stroke();
 ctx.beginPath();trace(base);ctx.lineTo(right,bottom);ctx.lineTo(left,bottom);ctx.closePath();ctx.fillStyle='#f0d64215';ctx.fill();
 if(patch.amount!==0){
  ctx.save();ctx.beginPath();trace(base.map(([px,py],i)=>[px,Math.min(py,peak[i][1])]));for(let i=peak.length-1;i>=0;i--)ctx.lineTo(peak[i][0],Math.max(base[i][1],peak[i][1]));ctx.closePath();ctx.clip();ctx.strokeStyle='#ff996c';
  for(let offset=left-(bottom-top);offset<right;offset+=7){ctx.beginPath();ctx.moveTo(offset,bottom);ctx.lineTo(offset+bottom-top,top);ctx.stroke()}ctx.restore();
 }
 ctx.beginPath();trace(current);ctx.strokeStyle='#f0d642';ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle='#aaa';ctx.font='10px Arial';ctx.fillText('FILTER SHAPE · live cutoff',left,12);ctx.fillText('20 Hz',left,h-4);ctx.fillText('20 kHz',right-36,h-4);
 c.setAttribute('aria-label',`Filter response at ${Math.round(cutoff)} Hz; diagonal-lined envelope range from ${Math.round(patch.cutoff)} to ${Math.round(demoCutoff(patch.cutoff,patch.amount,1))} Hz`);
}
function frame(){
 const voice=active||lastVoice,live=!!voice&&!voice.ended,patch=live?voice.patch:readPatch(voice?.patch.frequency),age=live?Math.max(0,audio.currentTime-voice.start):0;
 const releaseAt=live?voice.releaseAt:null,levels=demoLevels(age,releaseAt,patch,phaseCycles(live?voice:null,age));
 drawEnvelope($('filterScope'),patch.filterEnv,releaseAt,age,live);drawEnvelope($('ampScope'),patch.amp,releaseAt,age,live);drawLfo($('lfoScope'),live?voice:null,age,patch);drawResponse($('response'),patch,live?levels.cutoff:patch.cutoff);
 $('cutoffNow').textContent=`Cutoff: ${Math.round(live?levels.cutoff:patch.cutoff)} Hz`;$('ampNow').textContent=`Amp envelope: ${Math.round(live?levels.amp*100:0)}%`;$('lfoNow').textContent=`LFO: ${patch.lfoRate} Hz · ${patch.lfoAmount}% → ${patch.lfoDestination}`;
 if(live)$('status').textContent=voice.panicAt!=null?'stopping':voice.held?'note held':'release';else if(pending==null&&$('error').textContent==='')$('status').textContent=lastVoice?'note ended':'ready';
 requestAnimationFrame(frame);
}
update();resize();frame();

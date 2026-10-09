const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const values=Object.fromEntries([...html.matchAll(/<input id="([^"]+)"[^>]* value="([^"]+)"/g)].map(m=>[m[1],m[2]]));
values.filterType='lowpass';values.svfMode='lowpass';values.lfoShape='sine';values.lfoDestination='cutoff';
const elements={},oscillators=[],gains=[];
const drawing=new Proxy({}, {get:()=>()=>{}});
function param(){return {value:0,events:[],setValueAtTime(...args){this.events.push(['value',...args])},setValueCurveAtTime(...args){this.events.push(['curve',...args])},setTargetAtTime(...args){this.events.push(['target',...args])}}}
function node(extra={}){return {disconnected:false,connections:[],connect(target){this.connections.push(target)},disconnect(){this.disconnected=true},...extra}}
class Audio {
 currentTime=1;sampleRate=48000;audioWorklet={addModule:async()=>{}};state='running';destination={};resumeCalls=0;
 createBiquadFilter(){return node({Q:param(),detune:param(),frequency:param(),getFrequencyResponse(f,m,p){m.fill(1);p.fill(0)}})}
 createOscillator(){const osc=node({frequency:param(),detune:param(),starts:[],stops:[],start(t){this.starts.push(t)},stop(t){this.stops.push(t)}});oscillators.push(osc);return osc}
 createGain(){const gain=node({gain:param()});gains.push(gain);return gain}
 resume(){this.resumeCalls++;return new Promise(resolve=>{this.completeResume=()=>{this.state='running';resolve()}})}
}
const document={getElementById(id){return elements[id]??={value:values[id]??0,clientWidth:600,clientHeight:210,addEventListener(){},getContext(){return drawing},getBoundingClientRect(){return {width:600,height:210}},setAttribute(){}}},querySelectorAll(){return []}};
class WorkletNode {constructor(){Object.assign(this,node({parameters:new Map(['cutoff','resonance','model'].map(key=>[key,param()]))}))}}
const sandbox=vm.createContext({AudioWorkletNode:WorkletNode,document,window:{OfflineAudioContext:Audio,AudioContext:Audio,addEventListener(){}},devicePixelRatio:1,performance:{now:()=>1000},requestAnimationFrame:()=>1,cancelAnimationFrame(){},Float32Array});
vm.runInContext(readFileSync(join(__dirname,'../filter-dsp.js'),'utf8'),sandbox);
vm.runInContext(script,sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
 // Replay within the old voice's 30ms fade, before its ended callback runs.
 await run('play()');const first=oscillators[0],firstEnvelope=gains[0],firstOutput=gains[1];
 run('stop()');
 assert.equal(firstOutput.gain.events.at(-1)[0],'target');
 assert.equal(firstEnvelope.gain.events.at(-1)[0],'curve');
 assert.equal(elements.play.textContent,'▶ play note');
 const replay=run('play()');
 assert.equal(oscillators.length,2,'running audio starts the new oscillator synchronously');
 assert.equal(run('audio.resumeCalls'),0,'replay does not await resume on a running context');
 assert.equal(oscillators[1].starts.length,1);
 assert.equal(gains[3].gain.events[0][1],1,'new voice has its own audible output');
 first.onended();
 assert.equal(run('activeVoice.osc')===oscillators[1],true,'old cleanup preserves the new voice');
 assert.equal(gains[3].disconnected,false);
 await replay;run('stop()');oscillators[1].onended();
 // Stop and restart while the context is still waking up.
 run("audio.state='suspended'");
 const pending=run('play()');const completeFirst=run('audio.completeResume');
 run('stop()');const restart=run('play()');const completeSecond=run('audio.completeResume');
 completeFirst();await pending;
 assert.equal(oscillators.length,2,'cancelled startup cannot create a stale voice');
 completeSecond();await restart;
 assert.equal(oscillators.length,3);assert.equal(oscillators[2].starts.length,1);
 run('stop()');
 // Each lesson isolates the concept being taught, including the release tail.
 run("selectLesson('filter');document.getElementById('filterType').value='highpass'");
 await run('play()');
 assert.equal(run('activeFilter.type'),'highpass');
 assert.equal(run('filterEnv(.1)'),0,'filter lesson has no automatic cutoff movement');
 assert.equal(run("activeFilter.frequency.events.some(event=>event[0]==='curve')"),false);
 run("selectLesson('filterenv')");
 assert.equal(elements.play.textContent,'▶ play note','switching lessons stops the old note');
 await run('play()');
 assert.equal(run('activeFilter.type'),'lowpass');
 assert.equal(run("activeFilter.frequency.events.some(event=>event[0]==='curve')"),true);
 assert.equal(run("ampEnv(hold+v('fRelease')/2)"),1,'volume stays steady during filter release');
 assert.equal(run("ampEnv(hold+v('fRelease')+.08)"),0);
 run("selectLesson('ampenv')");await run('play()');
 assert.equal(run('activeVoice.osc.connections[0]===activeVoice.g'),true,'amp lesson bypasses the filter');
 assert.equal(run('filterEnv(.1)'),0);
 assert(run('ampEnv(.3)')<1,'amp envelope controls volume');
 run('stop()');
 // Negative amount must keep moving beyond -8%, for any starting cutoff.
 run("selectLesson('filterenv')");
 for(const cutoff of [5,28,95]){
   elements.cutoff.value=cutoff;let previous=Infinity;
   for(let amount=0;amount>=-80;amount--){
     elements.amount.value=amount;const peak=run('filterRange().peak');
     assert(peak<previous,`negative amount ${amount}% must still lower cutoff at ${cutoff}% cutoff`);
     assert(peak>=80-1e-9);previous=peak;
   }
   assert(Math.abs(previous-80)<1e-9);
   previous=0;
   for(let amount=0;amount<=100;amount++){
     elements.amount.value=amount;const peak=run('filterRange().peak');
     assert(peak>previous);assert(peak<=9000+1e-9);previous=peak;
   }
 }
 elements.cutoff.value=28;elements.amount.value=-33;
 await run('play()');
 const event=run("activeFilter.frequency.events.find(event=>event[0]==='curve')");
 for(const fraction of [0,.01,.1,.5,.9,1]){
   const index=Math.round((event[1].length-1)*fraction),t=event[3]*index/(event[1].length-1);
   assert(Math.abs(event[1][index]-run(`filterFrequency(${t})`))<.001,'audio and graph use the same cutoff movement');
 }
 run('stop()');
 // Teaching filter selection creates worklet nodes with live cutoff/resonance parameters.
 for(const [choice,svfMode,model] of [['svf','lowpass',0],['svf','bandpass',1],['svf','highpass',2],['ladder','lowpass',3]]){
   run("selectLesson('filter')");elements.filterType.value=choice;elements.svfMode.value=svfMode;run('updateLabels()');
   await run('play()');assert.equal(run('activeFilter.teaching'),true);assert.equal(run("activeFilter.parameters.get('model').value"),model);
   elements.cutoff.value=40;elements.res.value=60;run('updateLabels()');
   assert.equal(run('activeFilter.frequency.events.at(-1)[0]'),'target');
   assert.equal(run('activeFilter.Q.events.at(-1)[1]'),60/85);run('stop()');
 }
 // LFO motion is periodic, depth zero is neutral, and each audio destination is wired correctly.
 for(const destination of ['cutoff','volume','pitch']){
   run("selectLesson('lfo')");elements.lfoDestination.value=destination;elements.lfoAmount.value=100;elements.lfoRate.value=1;
   const atZero=run('lfoEffect(0)');assert(Math.abs(run('lfoEffect(1)')-atZero)<1e-8);
   assert.notEqual(run('lfoEffect(.25)'),run('lfoEffect(.75)'));
   await run('play()');
   assert.equal(run('activeVoice.lfoDepth.connections[0]=== '+(destination==='volume'?'activeVoice.modulation.gain':destination==='pitch'?'activeVoice.osc.detune':'activeFilter.detune')),true);
   elements.lfoRate.value=2;elements.lfoAmount.value=0;run('updateLabels()');
   assert.equal(run('activeVoice.lfo.frequency.events.at(-1)[1]'),2);
   assert.equal(run('activeVoice.lfoDepth.gain.events.at(-1)[1]'),0);
   assert.equal(run('lfoEffect(.125)'),run('lfoEffect(.375)'));
   const oldLfo=run('activeVoice.lfo');run('stop()');assert(oldLfo.stops.at(-1)<1.1,'stop also ends the modulation oscillator');
   await run('play()');assert.equal(run('activeVoice.osc.starts.length'),1);run('stop()');
 }
 // Rate changes preserve wave phase rather than jumping to a different point.
 elements.lfoShape.value='sine';elements.lfoRate.value=1;elements.lfoAmount.value=40;
 await run('play()');sandbox.performance.now=()=>1500;
 const cyclesBefore=run('lfoCycles(.5)');elements.lfoRate.value=2;run('updateLabels()');
 assert.equal(run('lfoCycles(.5)'),cyclesBefore);
 assert.equal(run('lfoCycles(.75)'),cyclesBefore+.5);run('stop()');
 elements.lfoShape.value='triangle';elements.lfoRate.value=1;assert(Math.abs(run('lfoWave(.125)')-.5)<1e-9);
 console.log('Passed envelope ranges, replay regressions, SVF/ladder routing, live filter controls, and all LFO destinations and depth/rate controls.');
})().catch(error=>{console.error(error);process.exitCode=1});

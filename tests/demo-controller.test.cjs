const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync(join(__dirname,'../demo.html'),'utf8');
function setup(){
 const values=Object.fromEntries([...html.matchAll(/<input id="([^"]+)"[^>]* value="([^"]+)"/g)].map(m=>[m[1],m[2]]));
 for(const match of html.matchAll(/<select id="([^"]+)"[^>]*><option value="([^"]+)"/g))values[match[1]]=match[2];
 const elements={},nodes=[],keys=[],draw=new Proxy({}, {get:()=>()=>{}});
 const element=id=>({id,value:values[id]??'',tagName:['wave','filterType','svfMode','lfoShape','lfoDestination'].includes(id)?'SELECT':'INPUT',style:{},dataset:{},classList:{toggle(){}},listeners:{},textContent:'',clientWidth:400,clientHeight:130,addEventListener(type,fn){this.listeners[type]=fn},setAttribute(){},appendChild(node){keys.push(node)},getContext(){return draw}});
 const windowListeners={};
 const document={hidden:false,addEventListener(){},getElementById(id){return elements[id]??=element(id)},querySelectorAll(selector){return selector==='.key'?keys:[]},createElement(){return element('')}};
 const parameter=()=>({value:0,setTargetAtTime(value){this.value=value}});
 class Audio {
  currentTime=1;sampleRate=48000;state='running';destination={};audioWorklet={addModule:async()=>{}};
  async resume(){this.state='running'}
  createGain(){return {gain:parameter(),connect(){},disconnect(){}}}
  createDynamicsCompressor(){return {threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),connect(){},disconnect(){}}}
 }
 class Worklet {
  constructor(context,name,options){this.patch=options.processorOptions.patch;this.messages=[];this.port={postMessage:message=>this.messages.push(message),close(){}};nodes.push(this)}connect(){}disconnect(){this.disconnected=true}
 }
 const context=vm.createContext({document,window:{AudioContext:Audio,addEventListener(type,fn){windowListeners[type]=fn}},AudioWorkletNode:Worklet,devicePixelRatio:1,requestAnimationFrame(){},setTimeout(){}});
 for(const file of ['filter-dsp.js','synth-voice.js','demo.js'])vm.runInContext(readFileSync(join(__dirname,'../',file),'utf8'),context);
 return {run:code=>vm.runInContext(code,context),elements,nodes,windowListeners,document};
}
(async()=>{
 const {run,elements,nodes,windowListeners,document}=setup();
 await run('noteOn(48)');assert.equal(run('active.held'),true);assert.equal(nodes.length,1);
 run('audio.currentTime=1.1;noteOff(48)');assert.equal(run('active.held'),false);assert(Math.abs(run('active.releaseAt')-.1)<1e-9);assert.equal(nodes[0].messages.at(-1).type,'release');
 await run('noteOn(52)');assert.equal(run('active.midi'),52);assert.equal(nodes[0].messages.at(-1).type,'panic');
 nodes[0].port.onmessage({data:{type:'ended'}});assert.equal(run('active.midi'),52,'cleanup from an old voice preserves the current note');
 elements.lfoDestination.value='pitch';elements.lfoAmount.value=40;elements.aAttack.value=2;run('update()');
 const patch=nodes[1].messages.at(-1).patch;assert.equal(patch.lfoDestination,'pitch');assert.equal(patch.lfoAmount,40);assert.equal(patch.amp.attack,2,'envelope edits apply to the held note');
 document.activeElement=elements.wave;windowListeners.blur();assert.equal(run('active.held'),true,'opening a native select does not silence the held note');
 for(const target of [elements.wave,elements.cutoff]){await windowListeners.keydown({key:'g',target:{closest(){return null}},preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));assert.equal(run('active.midi'),55);windowListeners.keyup({key:'g'});}
 await run('noteOn(52)');
 run('stopAll()');assert.equal(nodes.at(-1).messages.at(-1).type,'panic');await run('noteOn(48)');assert.equal(run('active.midi'),48);
 run('noteOff(52)');assert.equal(run('active.held'),true,'releasing an old keyboard note cannot stop a different new note');
 run('noteOff(48)');nodes.at(-1).port.onmessage({data:{type:'ended'}});assert.equal(run('active'),null);
 // A fast release during initial worklet loading cancels that pending note, not the next one.
 const next=setup();next.run('audio=new window.AudioContext();audio.audioWorklet.addModule=()=>new Promise(resolve=>audio.finishLoad=resolve)');
 const pending=next.run('noteOn(48)');await Promise.resolve();await Promise.resolve();
 next.run('noteOff(48)');const restart=next.run('noteOn(55)');next.run('audio.finishLoad()');await pending;await restart;
 assert.equal(next.nodes.length,1);assert.equal(next.run('active.midi'),55);next.run('stopAll()');
 console.log('Passed held-note release, immediate retrigger, old-voice cleanup, live controls, held-note envelope edits and keyboard input with focused controls, and cancellation/restart during startup.');
})().catch(error=>{console.error(error);process.exitCode=1});

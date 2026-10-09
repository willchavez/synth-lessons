// Shared envelope, modulation, and oscillator math for the demo audio and visuals.
const DemoFilterDSP=typeof require==='function'?require('./filter-dsp.js').SynthFilterDSP:globalThis.SynthFilterDSP;
function demoRise(p){return Math.expm1(3*p)/Math.expm1(3)}
function demoFall(p){return Math.expm1(-5*p)/Math.expm1(-5)}
function heldLevel(t,env){
  if(t<=0)return 0;
  if(t<env.attack)return demoRise(t/env.attack);
  if(t<env.attack+env.decay)return 1-(1-env.sustain)*demoFall((t-env.attack)/env.decay);
  return env.sustain;
}
function demoEnvelope(t,releaseAt,env){
  if(releaseAt==null||t<releaseAt)return heldLevel(t,env);
  const elapsed=t-releaseAt;
  return elapsed>=env.release?0:heldLevel(releaseAt,env)*(1-demoFall(elapsed/env.release));
}
function demoWave(phase,shape){const sine=Math.sin(2*Math.PI*phase);return shape==='triangle'?2/Math.PI*Math.asin(sine):sine}
function demoCutoff(base,amount,level){const limit=amount<0?80:9000,depth=amount<0?-amount/80:amount/100;return base*Math.pow(limit/base,depth*level)}
function demoLevels(age,releaseAt,patch,phase){
  const amp=demoEnvelope(age,releaseAt,patch.amp),filter=demoEnvelope(age,releaseAt,patch.filterEnv);
  const wave=demoWave(phase,patch.lfoShape),depth=patch.lfoAmount/100;
  let cutoff=demoCutoff(patch.cutoff,patch.amount,filter),volume=amp,pitch=patch.frequency;
  if(patch.lfoDestination==='cutoff'){
    const cents=Math.min(1800,1200*Math.log2(cutoff/20),1200*Math.log2(18000/cutoff))*depth;
    cutoff*=2**(wave*cents/1200);
  }else if(patch.lfoDestination==='volume')volume*=1-depth/2+wave*depth/2;
  else if(patch.lfoDestination==='pitch')pitch*=2**(wave*depth*100/1200);
  return {amp,filter,wave,cutoff,volume,pitch};
}
function polyBlep(phase,dt){
  if(phase<dt){const t=phase/dt;return 2*t-t*t-1}
  if(phase>1-dt){const t=(phase-1)/dt;return t*t+2*t+1}
  return 0;
}
function copyDemoPatch(patch){return {...patch,amp:{...patch.amp},filterEnv:{...patch.filterEnv}}}
class SynthVoiceDSP {
  constructor(sampleRate,patch){this.sampleRate=sampleRate;this.patch=copyDemoPatch(patch);this.age=0;this.releaseAt=null;this.phase=0;this.lfoPhase=0;this.panicAge=null;this.finished=false;this.filter=new DemoFilterDSP(sampleRate);}
  update(patch){
    // Every parameter stays live, including the envelopes of a held note.
    if(patch.model!==this.patch.model)this.filter=new DemoFilterDSP(this.sampleRate);
    this.patch={...copyDemoPatch(patch),frequency:this.patch.frequency};
  }
  release(){if(this.releaseAt==null)this.releaseAt=this.age;}
  panic(){if(this.panicAge==null)this.panicAge=0;}
  process(){
    if(this.finished)return 0;
    const p=this.patch,levels=demoLevels(this.age,this.releaseAt,p,this.lfoPhase);
    const dt=Math.min(.45,levels.pitch/this.sampleRate);
    let source;
    if(p.wave==='sine')source=Math.sin(2*Math.PI*this.phase);
    else if(p.wave==='square')source=(this.phase<.5?1:-1)+polyBlep(this.phase,dt)-polyBlep((this.phase+.5)%1,dt);
    else source=2*this.phase-1-polyBlep(this.phase,dt);
    const filtered=this.filter.process(source,levels.cutoff,p.resonance,p.model);
    const fade=this.panicAge==null?1:Math.max(0,1-this.panicAge/.015);
    const output=filtered*levels.volume*.14*fade;
    this.age+=1/this.sampleRate;this.phase=(this.phase+dt)%1;this.lfoPhase=(this.lfoPhase+p.lfoRate/this.sampleRate)%1;
    if(this.panicAge!=null)this.panicAge+=1/this.sampleRate;
    if(this.panicAge>=.015||(this.releaseAt!=null&&this.age>=this.releaseAt+p.amp.release))this.finished=true;
    return output;
  }
}
if(typeof globalThis!=='undefined')Object.assign(globalThis,{SynthVoiceDSP,demoEnvelope,demoWave,demoCutoff,demoLevels});
if(typeof module!=='undefined')module.exports={SynthVoiceDSP,demoEnvelope,demoWave,demoCutoff,demoLevels};

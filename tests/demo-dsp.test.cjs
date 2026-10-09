const assert=require('node:assert/strict');
const {SynthVoiceDSP,demoEnvelope,demoLevels}=require('../synth-voice.js');
const patch={frequency:130.8128,wave:'saw',cutoff:900,amount:55,resonance:.25,model:3,amp:{attack:.3,decay:.4,sustain:.6,release:.25},filterEnv:{attack:.6,decay:.5,sustain:.3,release:.4},lfoShape:'sine',lfoRate:2,lfoAmount:40,lfoDestination:'cutoff'};
const rate=48000;
// Releasing before the attack finishes must start from the current level, not sustain.
const voice=new SynthVoiceDSP(rate,patch);
for(let i=0;i<4800;i++)voice.process();
voice.release();const releaseAt=voice.releaseAt;
assert(releaseAt<patch.amp.attack);
const before=demoEnvelope(releaseAt,null,patch.amp),after=demoEnvelope(releaseAt,releaseAt,patch.amp);
assert.equal(before,after);
assert(before<patch.amp.sustain);
let tailEnergy=0;for(let i=0;i<rate*.3;i++){const sample=voice.process();assert(Number.isFinite(sample));tailEnergy+=sample*sample;}
assert(tailEnergy>0);assert(voice.finished);assert.equal(voice.process(),0);
// Envelopes and LFO combine on the same cutoff, while amp and tremolo combine on volume.
const noLfo={...patch,lfoAmount:0};
const plain=demoLevels(.2,null,noLfo,.25),modulated=demoLevels(.2,null,patch,.25);
assert(modulated.cutoff>plain.cutoff);
const tremolo={...patch,lfoDestination:'volume',lfoAmount:100};
assert.equal(demoLevels(.2,null,tremolo,.75).volume,0);
assert.equal(demoLevels(.2,null,tremolo,.25).volume,plain.amp);
// Every oscillator/filter/LFO combination renders real, stable audio and releases fully.
for(const wave of ['saw','square','sine'])for(const model of [0,1,2,3])for(const destination of ['cutoff','volume','pitch']){
 const dsp=new SynthVoiceDSP(rate,{...patch,wave,model,resonance:1,lfoDestination:destination});
 let energy=0;for(let i=0;i<12000;i++){const sample=dsp.process();assert(Number.isFinite(sample)&&Math.abs(sample)<10);energy+=sample*sample;}
 assert(energy>1e-6);dsp.release();for(let i=0;i<13000;i++)dsp.process();assert(dsp.finished);
}
// Parameter updates change held-note envelopes and preserve LFO phase; panic is independent of release.
const live=new SynthVoiceDSP(rate,patch);for(let i=0;i<1000;i++)live.process();const phase=live.lfoPhase;
live.update({...patch,model:0,lfoRate:4,amp:{...patch.amp,attack:2}});
assert.equal(live.patch.amp.attack,2);assert.equal(live.lfoPhase,phase);assert.equal(live.patch.lfoRate,4);
const sustained=new SynthVoiceDSP(rate,{...patch,amp:{...patch.amp,sustain:0},filterEnv:{...patch.filterEnv,sustain:0}});
for(let i=0;i<rate*1.2;i++)sustained.process();
assert.equal(demoLevels(sustained.age,null,sustained.patch,0).volume,0);
sustained.update({...patch,amp:{...patch.amp,sustain:1},filterEnv:{...patch.filterEnv,sustain:1}});
assert.equal(demoLevels(sustained.age,null,sustained.patch,0).volume,1);
assert.equal(demoLevels(sustained.age,null,sustained.patch,0).filter,1);
let heldEnergy=0;for(let i=0;i<2000;i++)heldEnergy+=sustained.process()**2;assert(heldEnergy>0,'changing sustain restores audible output without retriggering');
live.panic();for(let i=0;i<800;i++)live.process();assert(live.finished);assert.equal(live.process(),0);
const fresh=new SynthVoiceDSP(rate,patch);let energy=0;for(let i=0;i<4000;i++)energy+=fresh.process()**2;assert(energy>0,'new note renders immediately after stopping');
console.log('Passed combined envelopes/filter/LFO audio, early release continuity, all oscillator/filter/destination combinations, live updates, panic, and fresh-note restart.');

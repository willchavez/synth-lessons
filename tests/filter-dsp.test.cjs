const assert=require('node:assert/strict');
const {SynthFilterDSP,teachingFilterMagnitude}=require('../filter-dsp.js');
// Compare the real sample-processing algorithm to the response graph's transfer function.
for(const rate of [44100,48000])for(const model of [0,1,2,3])for(const resonance of [0,.5,1])for(const frequency of [250,1000,4000]){
 const dsp=new SynthFilterDSP(rate);let inputEnergy=0,outputEnergy=0;
 for(let i=0;i<rate;i++){
   const input=.0001*Math.sin(2*Math.PI*frequency*i/rate),output=dsp.process(input,1000,resonance,model);
   assert(Number.isFinite(output));
   if(i>=rate/2){inputEnergy+=input*input;outputEnergy+=output*output;}
 }
 const measured=Math.sqrt(outputEnergy/inputEnergy),expected=teachingFilterMagnitude(frequency,1000,resonance,model,rate);
 assert(Math.abs(measured-expected)/Math.max(expected,.00001)<.005,`model ${model}, ${frequency} Hz, resonance ${resonance}: ${measured} vs ${expected}`);
}
for(const model of [0,1,2,3]){
 const dsp=new SynthFilterDSP(48000);
 for(let i=0;i<96000;i++){
   const cutoff=i%2000<1000?80:9000;
   const output=dsp.process(Math.sin(i*.4),cutoff,1,model);
   assert(Number.isFinite(output)&&Math.abs(output)<100,'rapid cutoff sweeps remain stable');
 }
}
assert(teachingFilterMagnitude(4000,1000,0,3)<teachingFilterMagnitude(4000,1000,0,0),'ladder removes treble more steeply than SVF low-pass');
assert(teachingFilterMagnitude(100,1000,.5,2)<teachingFilterMagnitude(4000,1000,.5,2),'SVF high-pass removes bass');
assert(teachingFilterMagnitude(1000,1000,.5,1)>teachingFilterMagnitude(100,1000,.5,1),'SVF band-pass keeps the middle');
console.log('Passed actual SVF/ladder audio response versus graph, all response modes, steepness, and sweep stability.');

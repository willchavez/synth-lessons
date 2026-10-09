// Teaching models: a topology-preserving SVF and a four-stage feedback ladder.
// Shared by the audio worklet, response display, and offline DSP tests.
class SynthFilterDSP {
  constructor(sampleRate) { this.sampleRate=sampleRate;this.state=new Float64Array(4); }
  process(input,cutoff,resonance,model) {
    const g=Math.tan(Math.PI*Math.max(20,Math.min(this.sampleRate*.45,cutoff))/this.sampleRate);
    const r=Math.max(0,Math.min(1,resonance));
    if(model===3) {
      const G=g/(1+g),k=3.6*r;
      const s=this.state;
      const feedback=G*G*G*(1-G)*s[0]+G*G*(1-G)*s[1]+G*(1-G)*s[2]+(1-G)*s[3];
      let value=(Math.tanh(input*1.7)/1.7-k*feedback)/(1+k*G**4);
      for(let i=0;i<4;i++){const out=G*value+(1-G)*s[i];s[i]=2*out-s[i];value=out;}
      return value*(1+k*.35);
    }
    const k=2-1.92*r,a1=1/(1+g*(g+k));
    const v1=a1*(this.state[0]+g*(input-this.state[1]));
    const v2=this.state[1]+g*v1;
    this.state[0]=2*v1-this.state[0];this.state[1]=2*v2-this.state[1];
    return model===1?k*v1:model===2?input-k*v1-v2:v2;
  }
}
function teachingFilterMagnitude(frequency,cutoff,resonance,model,sampleRate=48000) {
  const r=Math.max(0,Math.min(1,resonance));
  const g=Math.tan(Math.PI*Math.min(sampleRate*.45,cutoff)/sampleRate);
  const omega=Math.tan(Math.PI*frequency/sampleRate);
  if(model===3){
    const square=z=>[z[0]*z[0]-z[1]*z[1],2*z[0]*z[1]];
    const h=square(square([g*g/(g*g+omega*omega),-g*omega/(g*g+omega*omega)]));
    const k=3.6*r,den=(1+k*h[0])**2+(k*h[1])**2;
    return Math.hypot(h[0],h[1])/Math.sqrt(den)*(1+k*.35);
  }
  const k=2-1.92*r,den=Math.hypot(g*g-omega*omega,k*g*omega);
  return (model===1?k*g*omega:model===2?omega*omega:g*g)/den;
}
if(typeof registerProcessor==='function') {
  class LessonFilterProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors(){return [
      {name:'cutoff',defaultValue:1080,minValue:20,maxValue:20000,automationRate:'a-rate'},
      {name:'detune',defaultValue:0,minValue:-4800,maxValue:4800,automationRate:'a-rate'},
      {name:'resonance',defaultValue:.2,minValue:0,maxValue:1,automationRate:'k-rate'},
      {name:'model',defaultValue:0,minValue:0,maxValue:3,automationRate:'k-rate'}
    ];}
    constructor(){super();this.running=true;this.port.onmessage=event=>{if(event.data==='stop')this.running=false};this.filters=[new SynthFilterDSP(sampleRate),new SynthFilterDSP(sampleRate)];}
    process(inputs,outputs,parameters){
      if(!this.running)return false;
      const input=inputs[0],output=outputs[0];
      for(let ch=0;ch<output.length;ch++){
        const source=input[ch]||input[0],dsp=this.filters[ch]||this.filters[0];
        for(let i=0;i<output[ch].length;i++){
          const cutoff=parameters.cutoff[parameters.cutoff.length===1?0:i];
          const detune=parameters.detune[parameters.detune.length===1?0:i];
          output[ch][i]=dsp.process(source?source[i]:0,cutoff*2**(detune/1200),parameters.resonance[0],Math.round(parameters.model[0]));
        }
      }
      return true;
    }
  }
  registerProcessor('lesson-filter',LessonFilterProcessor);
}
if(typeof module!=='undefined')module.exports={SynthFilterDSP,teachingFilterMagnitude};
// Make the DSP available to the demo's worklet module and classic browser scripts.
if(typeof globalThis!=='undefined')globalThis.SynthFilterDSP=SynthFilterDSP;

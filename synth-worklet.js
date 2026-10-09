import './filter-dsp.js';
import './synth-voice.js';
class SynthDemoProcessor extends AudioWorkletProcessor {
  constructor(options){
    super();this.voice=new globalThis.SynthVoiceDSP(sampleRate,options.processorOptions.patch);
    this.port.onmessage=event=>{
      if(event.data.type==='release')this.voice.release();
      else if(event.data.type==='panic')this.voice.panic();
      else if(event.data.type==='patch')this.voice.update(event.data.patch);
    };
  }
  process(inputs,outputs){
    const output=outputs[0];
    for(let i=0;i<output[0].length;i++){
      const sample=this.voice.process();
      for(const channel of output)channel[i]=sample;
    }
    if(this.voice.finished){this.port.postMessage({type:'ended'});return false;}
    return true;
  }
}
registerProcessor('synth-demo',SynthDemoProcessor);

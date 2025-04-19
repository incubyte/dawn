import { Effect, EffectType } from '../models/effect';

// Create an enhanced reverb effect with proper wet/dry mixing
export function createReverbEffect(audioContext: AudioContext): Effect {
  // Create all the nodes we need for the reverb effect

  // Convolver node for the reverb effect
  const convolver = audioContext.createConvolver();
  
  // Generate initial impulse response for reverb
  const reverbTime = 2; // 2 seconds default
  generateImpulseResponse(convolver, audioContext, reverbTime);
  
  // Wet gain for controlling amount of processed signal
  const wetGain = audioContext.createGain();
  wetGain.gain.value = 0.3; // 30% wet by default
  
  // Dry gain for controlling amount of unprocessed signal
  const dryGain = audioContext.createGain();
  dryGain.gain.value = 0.7; // 70% dry by default
  
  // Input node - this will be the main node that other nodes connect to
  const inputNode = audioContext.createGain();
  
  // Output node - all paths converge here before going to the output
  const outputNode = audioContext.createGain();
  
  // Create the routing for the reverb effect
  
  // Input splits into two paths: dry (unprocessed) and wet (processed)
  inputNode.connect(dryGain);     // Dry path (straight to output)
  inputNode.connect(convolver);   // Wet path (through convolver)
  
  // Connect the convolver to the wet gain
  convolver.connect(wetGain);
  
  // Connect both paths to the output
  dryGain.connect(outputNode);
  wetGain.connect(outputNode);
  
  // Create a custom node object that contains all the nodes we need to control
  const reverbEffect = {
    input: inputNode,
    output: outputNode,
    convolver: convolver,
    wet: wetGain,
    dry: dryGain,
    
    // Method to update the mix (wet/dry balance)
    setMix: function(mix: number) {
      // Ensure mix is between 0 and 1
      const safeMix = Math.max(0, Math.min(1, mix));
      
      // Set the wet and dry gain values based on the mix
      // A mix of 0 means fully dry (unprocessed)
      // A mix of 1 means fully wet (processed)
      const now = audioContext.currentTime;
      wetGain.gain.setValueAtTime(safeMix, now);
      dryGain.gain.setValueAtTime(1 - safeMix, now);
    },
    
    // Method to update the reverb time
    setReverbTime: function(time: number) {
      // Generate a new impulse response with the new time
      generateImpulseResponse(convolver, audioContext, time);
    },
    
    // Connect method (used when connecting other nodes to this effect)
    connect: function(destination: AudioNode) {
      outputNode.connect(destination);
    },
    
    // Disconnect method
    disconnect: function() {
      outputNode.disconnect();
    }
  };
  
  // Extend the input node to directly have our reverb methods
  (inputNode as any).setMix = reverbEffect.setMix;
  (inputNode as any).setReverbTime = reverbEffect.setReverbTime;
  (inputNode as any).connect = reverbEffect.connect;
  (inputNode as any).disconnect = reverbEffect.disconnect;
  
  // Store the reverbEffect object on the input node for easy access
  (inputNode as any).effectObj = reverbEffect;
  
  // Apply initial parameter values
  reverbEffect.setMix(0.3);
  reverbEffect.setReverbTime(2);

  // Return the Effect object with our custom reverb node
  return {
    id: crypto.randomUUID(),
    type: EffectType.Reverb,
    parameters: [
      {
        name: 'Mix',
        value: 0.3, // 30% initial wet/dry mix
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'Time',
        value: 2, // 2 seconds initial reverb time
        min: 0.1,
        max: 10,
        step: 0.1
      }
    ],
    bypass: false,
    // We use the input node as the main connection point
    node: inputNode
  };
}

// Helper function to generate an impulse response for the convolver
function generateImpulseResponse(
  convolver: ConvolverNode, 
  context: AudioContext, 
  duration: number
): void {
  // Calculate impulse length based on duration
  const impulseLength = context.sampleRate * duration;
  
  // Create a new impulse response buffer
  const impulse = context.createBuffer(
    2, // stereo
    impulseLength,
    context.sampleRate
  );
  
  // Fill both channels with a natural sounding reverb decay
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const channelData = impulse.getChannelData(channel);
    
    // Generate a more natural sounding reverb 
    for (let i = 0; i < channelData.length; i++) {
      // Decay curve with random elements for a natural sound
      const decayFactor = Math.pow(1 - i / impulseLength, 1.5);
      
      // Random noise with decreasing amplitude
      channelData[i] = (Math.random() * 2 - 1) * decayFactor;
      
      // Add some early reflections for realism
      if (i < 0.1 * impulseLength) {
        // Stronger early reflections
        channelData[i] *= 1.5;
      }
    }
  }
  
  // Apply the new impulse response to the convolver
  convolver.buffer = impulse;
}

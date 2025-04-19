import { Effect, EffectType } from '../models/effect';

// Create a more complex delay effect with proper routing for wet/dry mix
export function createDelayEffect(audioContext: AudioContext): Effect {
  // Create a more advanced delay effect with proper parameter control
  // This design uses the Web Audio API's AudioNode graph to create a flexible delay effect

  // Main delay node
  const delayNode = audioContext.createDelay();
  delayNode.delayTime.value = 0.5; // 500ms default delay time
  
  // Feedback gain for controlling delay feedback amount
  const feedbackGain = audioContext.createGain();
  feedbackGain.gain.value = 0.4; // 40% default feedback
  
  // Wet gain for controlling amount of processed signal
  const wetGain = audioContext.createGain();
  wetGain.gain.value = 0.5; // 50% wet by default
  
  // Dry gain for controlling amount of unprocessed signal
  const dryGain = audioContext.createGain();
  dryGain.gain.value = 0.5; // 50% dry by default
  
  // Input node - this will be the main node that other nodes connect to
  const inputNode = audioContext.createGain();
  
  // Output node - all paths converge here before going to the output
  const outputNode = audioContext.createGain();
  
  // Create the routing for the delay effect
  
  // Input splits into two paths: dry (unprocessed) and wet (processed)
  inputNode.connect(dryGain);        // Dry path (straight to output)
  inputNode.connect(delayNode);      // Wet path (through delay)
  
  // Connect the delay to the wet gain
  delayNode.connect(wetGain);
  
  // Create the feedback loop
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  
  // Connect both paths to the output
  dryGain.connect(outputNode);
  wetGain.connect(outputNode);
  
  // Create a custom node object that contains all the nodes we need to control
  const delayEffect = {
    input: inputNode,
    output: outputNode,
    delay: delayNode,
    feedback: feedbackGain,
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
    
    // Method to update the feedback amount
    setFeedback: function(amount: number) {
      // Ensure feedback is between 0 and 0.95 (to avoid infinite feedback)
      const safeFeedback = Math.max(0, Math.min(0.95, amount));
      
      // Set the feedback gain
      const now = audioContext.currentTime;
      feedbackGain.gain.setValueAtTime(safeFeedback, now);
    },
    
    // Method to update the delay time
    setDelayTime: function(time: number) {
      // Ensure time is in a reasonable range
      const safeTime = Math.max(0.01, Math.min(2, time));
      
      // Set the delay time
      const now = audioContext.currentTime;
      delayNode.delayTime.setValueAtTime(safeTime, now);
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
  
  // Extend the input node to directly have our delay methods
  (inputNode as any).setMix = delayEffect.setMix;
  (inputNode as any).setFeedback = delayEffect.setFeedback;
  (inputNode as any).setDelayTime = delayEffect.setDelayTime;
  (inputNode as any).connect = delayEffect.connect;
  (inputNode as any).disconnect = delayEffect.disconnect;
  
  // Store the delayEffect object on the input node for easy access
  (inputNode as any).effectObj = delayEffect;
  
  // Apply initial parameter values
  delayEffect.setDelayTime(0.5);
  delayEffect.setFeedback(0.4);
  delayEffect.setMix(0.5);

  // Return the Effect object with our custom delay node
  return {
    id: crypto.randomUUID(),
    type: EffectType.Delay,
    parameters: [
      {
        name: 'Time',
        value: 0.5, // 500ms initial delay time
        min: 0.01,
        max: 2,
        step: 0.01
      },
      {
        name: 'Feedback',
        value: 0.4, // 40% initial feedback
        min: 0,
        max: 0.95, // Limit to avoid infinite feedback
        step: 0.01
      },
      {
        name: 'Mix',
        value: 0.5, // 50% initial wet/dry mix
        min: 0,
        max: 1,
        step: 0.01
      }
    ],
    bypass: false,
    // We use the input node as the main connection point
    node: inputNode
  };
}

// Forwards mono microphone frames to the main thread for WAV encoding.
class RelaySttCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}

registerProcessor("relay-stt-capture", RelaySttCapture);

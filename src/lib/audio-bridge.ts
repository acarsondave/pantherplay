import { invoke, Channel } from '@tauri-apps/api/core';

export interface ChordEvent {
  chord: string;
  confidence: number;
  timestamp: number;
}

export interface OnsetEvent {
  energy: number;
  timestamp: number;
}

export interface AudioLevelEvent {
  rms: number;
}

export interface CalibrationCompleteEvent {
  frequency: number;
}

export type AudioEvent =
  | ({ type: 'ChordDetected' } & ChordEvent)
  | ({ type: 'OnsetDetected' } & OnsetEvent)
  | ({ type: 'AudioLevel' } & AudioLevelEvent)
  | ({ type: 'CalibrationComplete' } & CalibrationCompleteEvent);

export interface AudioDevice {
  id: string;
  name: string;
}

type EventCallback<T> = (data: T) => void;

class AudioBridge {
  private chordListeners: EventCallback<ChordEvent>[] = [];
  private onsetListeners: EventCallback<OnsetEvent>[] = [];
  private levelListeners: EventCallback<AudioLevelEvent>[] = [];
  private calibrationListeners: EventCallback<CalibrationCompleteEvent>[] = [];
  private isListening = false;

  public async startListening(deviceId?: string) {
    if (this.isListening) return;

    const channel = new Channel<AudioEvent>();
    channel.onmessage = (event) => {
      switch (event.type) {
        case 'ChordDetected':
          this.chordListeners.forEach(l => l(event));
          break;
        case 'OnsetDetected':
          this.onsetListeners.forEach(l => l(event));
          break;
        case 'AudioLevel':
          this.levelListeners.forEach(l => l(event));
          break;
        case 'CalibrationComplete':
          this.calibrationListeners.forEach(l => l(event));
          break;
      }
    };

    try {
      await invoke('start_listening', { 
        deviceId: deviceId || null, 
        onEvent: channel 
      });
      this.isListening = true;
    } catch (e) {
      console.error('Failed to start listening:', e);
      throw e;
    }
  }

  public async stopListening() {
    if (!this.isListening) return;
    try {
      await invoke('stop_listening');
      this.isListening = false;
    } catch (e) {
      console.error('Failed to stop listening:', e);
    }
  }

  public async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      return await invoke('get_audio_devices');
    } catch (e) {
      console.error('Failed to get audio devices:', e);
      return [];
    }
  }

  public async calibratePitch() {
    try {
      await invoke('calibrate_pitch');
    } catch (e) {
      console.error('Failed to calibrate pitch:', e);
    }
  }

  public onChord(callback: EventCallback<ChordEvent>) {
    this.chordListeners.push(callback);
    return () => {
      this.chordListeners = this.chordListeners.filter(l => l !== callback);
    };
  }

  public onOnset(callback: EventCallback<OnsetEvent>) {
    this.onsetListeners.push(callback);
    return () => {
      this.onsetListeners = this.onsetListeners.filter(l => l !== callback);
    };
  }

  public onLevel(callback: EventCallback<AudioLevelEvent>) {
    this.levelListeners.push(callback);
    return () => {
      this.levelListeners = this.levelListeners.filter(l => l !== callback);
    };
  }

  public onCalibrationComplete(callback: EventCallback<CalibrationCompleteEvent>) {
    this.calibrationListeners.push(callback);
    return () => {
      this.calibrationListeners = this.calibrationListeners.filter(l => l !== callback);
    };
  }
}

export const audio = new AudioBridge();

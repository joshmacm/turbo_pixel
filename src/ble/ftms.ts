import {
  encodeSetTargetPower,
  parseIndoorBikeData,
  type IndoorBikeData,
} from './parsers';

const FTMS_SERVICE = 0x1826;
const INDOOR_BIKE_DATA_CHAR = 0x2ad2;
const CONTROL_POINT_CHAR = 0x2ad9;

export type TrainerStatusCallback = (connected: boolean, name?: string, error?: string) => void;
export type TrainerDataCallback = (data: IndoorBikeData) => void;

export class FtmsTrainer {
  private device: BluetoothDevice | null = null;
  private controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  private bikeDataChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private hasControl = false;

  private onData: TrainerDataCallback;
  private onStatus: TrainerStatusCallback;

  constructor(onData: TrainerDataCallback, onStatus: TrainerStatusCallback) {
    this.onData = onData;
    this.onStatus = onStatus;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge on localhost/HTTPS.');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS_SERVICE] }],
      optionalServices: [0x1818, 0x180a],
    });

    this.device = device;
    device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(FTMS_SERVICE);

    this.bikeDataChar = await service.getCharacteristic(INDOOR_BIKE_DATA_CHAR);
    this.bikeDataChar.addEventListener('characteristicvaluechanged', this.handleBikeData);
    await this.bikeDataChar.startNotifications();

    try {
      this.controlChar = await service.getCharacteristic(CONTROL_POINT_CHAR);
      this.controlChar.addEventListener('characteristicvaluechanged', this.handleControlResponse);
      await this.controlChar.startNotifications();

      await this.sendControlCommand(new Uint8Array([0x00])); // Request Control
      this.hasControl = true;
      await this.sendControlCommand(new Uint8Array([0x07])); // Start or Resume
    } catch (err) {
      console.warn('FTMS Control Point setup warning:', err);
    }

    this.onStatus(true, device.name || 'Saris H3 / FTMS');
  }

  async setTargetPower(watts: number): Promise<void> {
    if (!this.controlChar) return;
    if (!this.hasControl) {
      await this.sendControlCommand(new Uint8Array([0x00]));
      this.hasControl = true;
    }
    await this.sendControlCommand(encodeSetTargetPower(watts));
  }

  async pause(): Promise<void> {
    if (!this.controlChar) return;
    await this.sendControlCommand(new Uint8Array([0x08, 0x02]));
  }

  async resume(): Promise<void> {
    if (!this.controlChar) return;
    await this.sendControlCommand(new Uint8Array([0x07]));
  }

  disconnect(): void {
    this.hasControl = false;
    if (this.bikeDataChar) {
      this.bikeDataChar.removeEventListener('characteristicvaluechanged', this.handleBikeData);
    }
    if (this.controlChar) {
      this.controlChar.removeEventListener('characteristicvaluechanged', this.handleControlResponse);
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = null;
    this.controlChar = null;
    this.bikeDataChar = null;
    this.onStatus(false);
  }

  private sendControlCommand(payload: Uint8Array): Promise<void> {
    const char = this.controlChar;
    if (!char) return Promise.resolve();

    const task = this.writeQueue.then(async () => {
      try {
        const buffer = payload.buffer.slice(
          payload.byteOffset,
          payload.byteOffset + payload.byteLength
        ) as ArrayBuffer;
        if (typeof char.writeValueWithResponse === 'function') {
          await char.writeValueWithResponse(buffer);
        } else {
          await char.writeValue(buffer);
        }
      } catch (err) {
        console.warn('FTMS write failed:', err);
      }
    });

    this.writeQueue = task.catch(() => undefined);
    return task;
  }

  private handleBikeData = (event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (!char.value) return;
    const parsed = parseIndoorBikeData(char.value);
    this.onData(parsed);
  };

  private handleControlResponse = (event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (!char.value || char.value.byteLength < 3) return;
    const opCode = char.value.getUint8(0);
    const reqOpCode = char.value.getUint8(1);
    const result = char.value.getUint8(2);
    if (opCode === 0x80 && result !== 0x01) {
      console.warn(`FTMS Control Point error: req=0x${reqOpCode.toString(16)} result=0x${result.toString(16)}`);
    }
  };

  private handleDisconnect = () => {
    this.hasControl = false;
    this.controlChar = null;
    this.bikeDataChar = null;
    this.onStatus(false, undefined, 'Trainer disconnected');
  };
}

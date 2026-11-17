import { parseHeartRateMeasurement } from './parsers';

const HR_SERVICE = 0x180d;
const HR_MEASUREMENT_CHAR = 0x2a37;

export type HrStatusCallback = (connected: boolean, name?: string, error?: string) => void;
export type HrDataCallback = (bpm: number) => void;

export class HeartRateMonitor {
  private device: BluetoothDevice | null = null;
  private hrChar: BluetoothRemoteGATTCharacteristic | null = null;
  private onData: HrDataCallback;
  private onStatus: HrStatusCallback;

  constructor(onData: HrDataCallback, onStatus: HrStatusCallback) {
    this.onData = onData;
    this.onStatus = onStatus;
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser.');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
    });

    this.device = device;
    device.addEventListener('gattserverdisconnected', this.handleDisconnect);

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    this.hrChar = await service.getCharacteristic(HR_MEASUREMENT_CHAR);
    this.hrChar.addEventListener('characteristicvaluechanged', this.handleHrData);
    await this.hrChar.startNotifications();

    this.onStatus(true, device.name || 'Coospo HRM');
  }

  disconnect(): void {
    if (this.hrChar) {
      this.hrChar.removeEventListener('characteristicvaluechanged', this.handleHrData);
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = null;
    this.hrChar = null;
    this.onStatus(false);
  }

  private handleHrData = (event: Event) => {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    if (!char.value) return;
    const bpm = parseHeartRateMeasurement(char.value);
    if (bpm !== null && bpm > 0) {
      this.onData(bpm);
    }
  };

  private handleDisconnect = () => {
    this.hrChar = null;
    this.onStatus(false, undefined, 'HRM disconnected');
  };
}

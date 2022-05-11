import { MatchMode } from "./Match";

export interface Packet {
    data: Uint8Array
}

export interface ControllerBoundPacket extends Packet {
    replyLength: number
}

export class Controller {
    port: SerialPort | null = null;
    reader: ReadableStreamDefaultReader | null = null;
    writer: WritableStreamDefaultWriter | null = null;

    bytesExpected: number = 0;

    async setMatchMode(e: MatchMode) {
        let data;
        switch (e) {
            case "autonomous":
                data = Uint8Array.from([201, 54, 184, 71, 88, 193, 5, 10, 0, 0, 0, 0, 146, 124]);
                break;
            case "driver":
                data = Uint8Array.from([201, 54, 184, 71, 88, 193, 5, 8, 0, 0, 0, 0, 214, 255]);
                break;
            case "disabled":
                data = Uint8Array.from([201, 54, 184, 71, 88, 193, 5, 11, 0, 0, 0, 0, 56, 45]);
        }
        await this.writeData({ data, replyLength: 65535 }, (() => { }));
    }

    async writeData(packet: ControllerBoundPacket, callback: any) {
        if (this.writer == null)
            return false;

        this.bytesExpected = packet.replyLength;

        await this.writer?.write(packet.data);
        return true;
    }

    async connect(requestPort: boolean = true) {
        if (!navigator || !navigator.serial)
            throw new Error("Not supported.");


        const requestOptions = { filters: [{ usbVendorId: 10376 }] };
        const availablePorts = (await navigator.serial.getPorts())
            .filter((e => 10376 === e.getInfo().usbVendorId))
            .filter((e => !e.readable));
        this.port = availablePorts[0];

        if (!this.port) {
            if (!requestPort)
                throw new Error("No port found.");
            this.port = await navigator.serial.requestPort(requestOptions);
        }

        await this.port.open({ baudRate: 115200 });

        this.port.addEventListener("disconnect", (async () => {
            await this.disconnect();
            console.log("Disconnected");
        }));
        this.writer = this.port.writable.getWriter();
        this.reader = this.port.readable.getReader();

        console.log("info:", this.port.getInfo());
        
    }

    async disconnect() {
        try {
            this.reader?.releaseLock();
            // this.reader?.cancel();
        } catch (e) { }

        try {
            this.writer?.releaseLock();
            // this.writer?.close();
        } catch (e) { }

        try {
            await this.port?.close()
        } catch (e) { }

        this.port = null;
        this.reader = null;
        this.writer = null;
    }

    isConnected() {
        return this.port != null;
    }
}
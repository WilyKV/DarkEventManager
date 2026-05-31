import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import dgram from 'dgram';
import os from 'os';
import { verifyWebSocketToken, getWebSocketSecret } from './sync-middleware';
import { storage } from './storage';
import { validateWebSocketSecret } from './websocket-secret-config';

interface SyncClient {
  ws: WebSocket;
  deviceId: string;
  deviceName: string;
  connectedAt: Date;
  isAuthenticated: boolean;
}

export class WebSocketSyncServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, SyncClient> = new Map();
  private udpServer: dgram.Socket | null = null;
  private broadcastPort: number = 8888;
  private httpServer: Server | null = null;
  private wsSecret: string;

  start(httpServer: Server) {
    this.httpServer = httpServer;
    this.wsSecret = getWebSocketSecret();

    const secretCheck = validateWebSocketSecret(process.env as Record<string, string | undefined>);
    if (secretCheck.mode === 'fail') {
      throw new Error(secretCheck.message);
    } else if (secretCheck.mode === 'warn') {
      console.warn('[WebSocket] ' + secretCheck.message);
    }

    // Create WebSocket server on the same HTTP server (no separate port)
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      perMessageDeflate: false,
      // Important for WiFi Direct: don't verify origin at connection level
      // We'll verify authentication via token in the register message
      verifyClient: () => true,
      // Increase max payload size for data sync
      maxPayload: 100 * 1024 * 1024, // 100MB
    });

    const localIP = this.getLocalIP();
    const port = this.getServerPort();
    console.log(`WebSocket Sync Server started on /ws path`);
    console.log(`Server accessible at: ws://${localIP}:${port}/ws`);
    console.log(`Clients can connect using this address`);
    console.log(`WebSocket secret initialized (length: ${this.wsSecret.length})`);

    // Start UDP broadcast for auto-discovery
    this.startDiscoveryBroadcast();

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('New WebSocket connection from:', req.socket.remoteAddress);

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
        // Remove client from the list
        for (const [deviceId, client] of this.clients.entries()) {
          if (client.ws === ws) {
            console.log(`Client ${client.deviceName} (${deviceId}) disconnected`);
            this.clients.delete(deviceId);
            this.broadcastClientList();
            break;
          }
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearInterval(pingInterval);
      });

      ws.on('pong', () => {
        // Connection is alive
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket Server error:', error);
    });
  }

  private startDiscoveryBroadcast() {
    try {
      this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.udpServer.on('error', (err) => {
        console.error('UDP Server error:', err);
        this.udpServer?.close();
      });

      this.udpServer.on('message', (msg, rinfo) => {
        const message = msg.toString();

        if (message === 'DARK_EVENT_DISCOVER') {
          // Respond with server info
          const serverInfo = {
            type: 'DARK_EVENT_SERVER',
            ip: this.getLocalIP(),
            port: this.getServerPort(),
            clients: this.clients.size
          };

          const response = Buffer.from(JSON.stringify(serverInfo));
          this.udpServer?.send(response, rinfo.port, rinfo.address, (err) => {
            if (err) {
              console.error('Error sending discovery response:', err);
            } else {
              console.log(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
            }
          });
        }
      });

      this.udpServer.on('listening', () => {
        const address = this.udpServer?.address();
        console.log(`UDP Discovery Server listening on ${address?.address}:${address?.port}`);

        try {
          this.udpServer?.setBroadcast(true);
        } catch (err) {
          console.error('Error enabling broadcast:', err);
        }
      });

      this.udpServer.bind(this.broadcastPort, '0.0.0.0');
    } catch (error) {
      console.error('Failed to start discovery broadcast:', error);
    }
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    const candidates: Array<{ip: string, priority: number, name: string}> = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;

      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          let priority = 0;
          const ip = addr.address;

          // Highest priority: WiFi Direct interfaces
          if (name.toLowerCase().includes('p2p') ||
              name.toLowerCase().includes('wifi-direct') ||
              name.toLowerCase().includes('wlan') && ip.startsWith('192.168.49.')) {
            priority = 100;
            console.log(`Found WiFi Direct IP: ${ip} on ${name}`);
          }
          // High priority: Mobile hotspot (usually 192.168.43.x or 192.168.49.x)
          else if (ip.startsWith('192.168.49.') || ip.startsWith('192.168.43.')) {
            priority = 90;
            console.log(`Found mobile hotspot IP: ${ip} on ${name}`);
          }
          // Medium priority: Standard WiFi/Ethernet (192.168.x.x, 10.x.x.x)
          else if (ip.startsWith('192.168.') || ip.startsWith('10.')) {
            priority = 50;
            console.log(`Found local network IP: ${ip} on ${name}`);
          }
          // Low priority: Other private networks (172.x.x.x)
          else if (ip.startsWith('172.')) {
            priority = 30;
            console.log(`Found private network IP: ${ip} on ${name}`);
          }
          // Lowest priority: Other IPs
          else {
            priority = 10;
            console.log(`Found other IP: ${ip} on ${name}`);
          }

          candidates.push({ ip, priority, name });
        }
      }
    }

    // Sort by priority (highest first) and return the best candidate
    candidates.sort((a, b) => b.priority - a.priority);

    if (candidates.length > 0) {
      const best = candidates[0];
      console.log(`Selected IP: ${best.ip} on ${best.name} (priority: ${best.priority})`);
      return best.ip;
    }

    console.log('No suitable IP found, using 0.0.0.0');
    return '0.0.0.0';
  }

  private getServerPort(): number {
    if (this.httpServer) {
      const address = this.httpServer.address();
      if (address && typeof address === 'object') {
        return address.port;
      }
    }
    return parseInt(process.env.PORT || '5000', 10);
  }

  private handleMessage(ws: WebSocket, message: any) {
    // Allow registration without authentication check
    if (message.type === 'register') {
      this.handleRegister(ws, message);
      return;
    }

    // For all other messages, verify client is authenticated
    const client = Array.from(this.clients.values()).find(c => c.ws === ws);
    if (!client || !client.isAuthenticated) {
      console.log('Unauthorized message attempt from unauthenticated client');
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
      ws.close(4004, 'Not authenticated');
      return;
    }

    switch (message.type) {
      case 'sync-request':
        this.handleSyncRequest(ws, message);
        break;

      case 'sync-data':
        this.handleSyncData(ws, message);
        break;

      case 'get-clients':
        this.sendClientList(ws);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  private async handleRegister(ws: WebSocket, message: any) {
    const { deviceId, deviceName, authToken } = message;

    if (!deviceId || !deviceName) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing deviceId or deviceName' }));
      ws.close(4001, 'Missing credentials');
      return;
    }

    // Verify authentication token
    if (!authToken) {
      console.log(`Registration denied: No auth token provided by ${deviceName}`);
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      ws.close(4002, 'Missing auth token');
      return;
    }

    const verifiedDeviceId = verifyWebSocketToken(authToken, this.wsSecret);
    if (!verifiedDeviceId || verifiedDeviceId !== deviceId) {
      console.log(`Registration denied: Invalid token for ${deviceName} (${deviceId})`);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid authentication token' }));
      ws.close(4003, 'Invalid token');
      return;
    }

    // Check if device is allowed to connect (only in offline mode)
    try {
      const config = await storage.getSyncConfig();

      // In offline mode, verify device permissions
      if (!config.isOnlineMode) {
        const isMaster = config.masterDeviceId === deviceId;

        // Log connection attempt
        console.log(`Connection attempt in offline mode: ${deviceName} (${deviceId}), Master: ${isMaster}`);

        // For now, allow all authenticated devices to connect
        // They can receive data, but only master can send modifications
      }
    } catch (error) {
      console.error('Error checking sync config:', error);
    }

    // Register the client
    this.clients.set(deviceId, {
      ws,
      deviceId,
      deviceName,
      connectedAt: new Date(),
      isAuthenticated: true,
    });

    console.log(`✅ Client authenticated and registered: ${deviceName} (${deviceId})`);

    // Send confirmation with server info
    ws.send(JSON.stringify({
      type: 'registered',
      deviceId,
      deviceName,
      serverIP: this.getLocalIP(),
      serverPort: this.getServerPort(),
      connectedClients: Array.from(this.clients.values()).map(c => ({
        deviceId: c.deviceId,
        deviceName: c.deviceName,
        connectedAt: c.connectedAt,
      })),
    }));

    // Broadcast updated client list to all
    this.broadcastClientList();
  }

  private handleSyncRequest(ws: WebSocket, message: any) {
    const { targetDeviceId, requestType } = message;

    const targetClient = this.clients.get(targetDeviceId);
    if (!targetClient) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Target device not connected'
      }));
      return;
    }

    // Forward sync request to target device
    const sourceClient = Array.from(this.clients.values()).find(c => c.ws === ws);
    if (sourceClient) {
      targetClient.ws.send(JSON.stringify({
        type: 'sync-request',
        sourceDeviceId: sourceClient.deviceId,
        sourceDeviceName: sourceClient.deviceName,
        requestType,
      }));
    }
  }

  private async handleSyncData(ws: WebSocket, message: any) {
    const { targetDeviceId, syncData, dataType } = message;

    // Validate payload structure
    if (!dataType || typeof dataType !== 'string') {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid dataType' }));
      return;
    }

    if (!syncData || typeof syncData !== 'object') {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid syncData' }));
      return;
    }

    // Get source client
    const sourceClient = Array.from(this.clients.values()).find(c => c.ws === ws);
    if (!sourceClient) {
      ws.send(JSON.stringify({ type: 'error', message: 'Client not found' }));
      return;
    }

    // In offline mode, verify only master can send data
    try {
      const config = await storage.getSyncConfig();

      if (!config.isOnlineMode) {
        const isMaster = config.masterDeviceId === sourceClient.deviceId;

        if (!isMaster) {
          console.log(`Sync data rejected: ${sourceClient.deviceName} is not the master device`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Seul l\'appareil maître peut envoyer des données en mode hors ligne',
          }));
          return;
        }
      }
    } catch (error) {
      console.error('Error checking sync permissions:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Permission check failed' }));
      return;
    }

    // Validate payload size (max 10MB per message)
    const payloadSize = JSON.stringify(syncData).length;
    if (payloadSize > 10 * 1024 * 1024) {
      ws.send(JSON.stringify({ type: 'error', message: 'Payload too large (max 10MB)' }));
      return;
    }

    // Validate dataType is one of allowed types
    const allowedDataTypes = ['participants', 'squads', 'timeslots', 'all'];
    if (!allowedDataTypes.includes(dataType)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid dataType' }));
      return;
    }

    console.log(`📤 Sync data from ${sourceClient.deviceName}: type=${dataType}, size=${payloadSize} bytes`);

    if (targetDeviceId) {
      // Send to specific device
      const targetClient = this.clients.get(targetDeviceId);
      if (targetClient) {
        targetClient.ws.send(JSON.stringify({
          type: 'sync-data',
          sourceDeviceId: sourceClient.deviceId,
          sourceDeviceName: sourceClient.deviceName,
          dataType,
          data: syncData,
        }));
        console.log(`📩 Sync data sent to ${targetClient.deviceName}`);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Target device not found' }));
      }
    } else {
      // Broadcast to all clients except sender
      let sentCount = 0;
      this.clients.forEach((client) => {
        if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'sync-data',
            sourceDeviceId: sourceClient.deviceId,
            sourceDeviceName: sourceClient.deviceName,
            dataType,
            data: syncData,
          }));
          sentCount++;
        }
      });
      console.log(`📡 Sync data broadcast to ${sentCount} clients`);
    }
  }

  private sendClientList(ws: WebSocket) {
    const clientList = Array.from(this.clients.values()).map(c => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      connectedAt: c.connectedAt,
    }));

    ws.send(JSON.stringify({
      type: 'client-list',
      clients: clientList,
    }));
  }

  private broadcastClientList() {
    const clientList = Array.from(this.clients.values()).map(c => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      connectedAt: c.connectedAt,
    }));

    const message = JSON.stringify({
      type: 'client-list',
      clients: clientList,
    });

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  getConnectedClients() {
    return Array.from(this.clients.values()).map(c => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      connectedAt: c.connectedAt,
    }));
  }

  stop() {
    if (this.udpServer) {
      this.udpServer.close();
      this.udpServer = null;
      console.log('UDP Discovery Server stopped');
    }

    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      console.log('WebSocket Sync Server stopped');
    }
  }
}

export const wsSyncServer = new WebSocketSyncServer();

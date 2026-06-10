import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import dgram from 'dgram';
import os from 'os';
import { verifyWebSocketToken, getWebSocketSecret } from './sync-middleware';
import { storage } from './storage';
import { validateWebSocketSecret } from './websocket-secret-config';
import { childLogger } from './logger';
import {
  WS_MAX_PAYLOAD_BYTES,
  WS_PING_INTERVAL_MS,
  WS_SYNC_DATA_MAX_BYTES,
  UDP_DISCOVERY_PORT,
} from './config/limits';

const wsLogger = childLogger('websocket');

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
  private broadcastPort: number = UDP_DISCOVERY_PORT;
  private httpServer: Server | null = null;
  private wsSecret: string;

  start(httpServer: Server) {
    this.httpServer = httpServer;
    this.wsSecret = getWebSocketSecret();

    const secretCheck = validateWebSocketSecret(process.env as Record<string, string | undefined>);
    if (secretCheck.mode === 'fail') {
      throw new Error(secretCheck.message);
    } else if (secretCheck.mode === 'warn') {
      wsLogger.warn(secretCheck.message);
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
      maxPayload: WS_MAX_PAYLOAD_BYTES,
    });

    const localIP = this.getLocalIP();
    const port = this.getServerPort();
    wsLogger.info({ url: `ws://${localIP}:${port}/ws`, secretLength: this.wsSecret.length }, 'WebSocket Sync Server démarré');

    // Start UDP broadcast for auto-discovery
    this.startDiscoveryBroadcast();

    this.wss.on('connection', (ws: WebSocket, req) => {
      wsLogger.debug({ remoteAddress: req.socket.remoteAddress }, 'Nouvelle connexion WebSocket');

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, WS_PING_INTERVAL_MS);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          wsLogger.error({ err: error }, 'Erreur parsing message WebSocket');
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
        // Remove client from the list
        for (const [deviceId, client] of this.clients.entries()) {
          if (client.ws === ws) {
            wsLogger.info({ deviceId, deviceName: client.deviceName }, 'Client déconnecté');
            this.clients.delete(deviceId);
            this.broadcastClientList();
            break;
          }
        }
      });

      ws.on('error', (error) => {
        wsLogger.error({ err: error }, 'Erreur WebSocket client');
        clearInterval(pingInterval);
      });

      ws.on('pong', () => {
        // Connection is alive
      });
    });

    this.wss.on('error', (error) => {
      wsLogger.error({ err: error }, 'Erreur serveur WebSocket');
    });
  }

  private startDiscoveryBroadcast() {
    try {
      this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.udpServer.on('error', (err) => {
        wsLogger.error({ err }, 'Erreur serveur UDP');
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
              wsLogger.error({ err }, 'Erreur envoi réponse découverte UDP');
            } else {
              wsLogger.debug({ address: rinfo.address, port: rinfo.port }, 'Réponse découverte UDP envoyée');
            }
          });
        }
      });

      this.udpServer.on('listening', () => {
        const address = this.udpServer?.address();
        wsLogger.info({ address: address?.address, port: address?.port }, 'Serveur UDP découverte en écoute');

        try {
          this.udpServer?.setBroadcast(true);
        } catch (err) {
          wsLogger.error({ err }, 'Erreur activation broadcast UDP');
        }
      });

      this.udpServer.bind(this.broadcastPort, '0.0.0.0');
    } catch (error) {
      wsLogger.error({ err: error }, 'Echec démarrage broadcast découverte');
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
            wsLogger.debug({ ip, name, type: 'wifi-direct' }, 'IP WiFi Direct trouvée');
          }
          // High priority: Mobile hotspot (usually 192.168.43.x or 192.168.49.x)
          else if (ip.startsWith('192.168.49.') || ip.startsWith('192.168.43.')) {
            priority = 90;
            wsLogger.debug({ ip, name, type: 'hotspot' }, 'IP hotspot mobile trouvée');
          }
          // Medium priority: Standard WiFi/Ethernet (192.168.x.x, 10.x.x.x)
          else if (ip.startsWith('192.168.') || ip.startsWith('10.')) {
            priority = 50;
            wsLogger.debug({ ip, name, type: 'local' }, 'IP réseau local trouvée');
          }
          // Low priority: Other private networks (172.x.x.x)
          else if (ip.startsWith('172.')) {
            priority = 30;
            wsLogger.debug({ ip, name, type: 'private' }, 'IP réseau privé trouvée');
          }
          // Lowest priority: Other IPs
          else {
            priority = 10;
            wsLogger.debug({ ip, name, type: 'other' }, 'Autre IP trouvée');
          }

          candidates.push({ ip, priority, name });
        }
      }
    }

    // Sort by priority (highest first) and return the best candidate
    candidates.sort((a, b) => b.priority - a.priority);

    if (candidates.length > 0) {
      const best = candidates[0];
      wsLogger.debug({ ip: best.ip, name: best.name, priority: best.priority }, 'IP sélectionnée');
      return best.ip;
    }

    wsLogger.debug('Aucune IP adaptée trouvée, utilisation de 0.0.0.0');
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
      wsLogger.warn('Tentative de message non autorisé par un client non authentifié');
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
      wsLogger.warn({ deviceName }, 'Enregistrement refusé : token absent');
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      ws.close(4002, 'Missing auth token');
      return;
    }

    const verifiedDeviceId = verifyWebSocketToken(authToken, this.wsSecret);
    if (!verifiedDeviceId || verifiedDeviceId !== deviceId) {
      wsLogger.warn({ deviceName, deviceId }, 'Enregistrement refusé : token invalide');
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

        wsLogger.info({ deviceName, deviceId, isMaster }, 'Tentative connexion en mode hors ligne');

        // For now, allow all authenticated devices to connect
        // They can receive data, but only master can send modifications
      }
    } catch (error) {
      wsLogger.error({ err: error }, 'Erreur vérification configuration sync');
    }

    // Register the client
    this.clients.set(deviceId, {
      ws,
      deviceId,
      deviceName,
      connectedAt: new Date(),
      isAuthenticated: true,
    });

    wsLogger.info({ deviceName, deviceId }, 'Client authentifié et enregistré');

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
          wsLogger.warn({ deviceName: sourceClient.deviceName }, 'Données sync refusées : appareil non maître');
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Seul l\'appareil maître peut envoyer des données en mode hors ligne',
          }));
          return;
        }
      }
    } catch (error) {
      wsLogger.error({ err: error }, 'Erreur vérification permissions sync');
      ws.send(JSON.stringify({ type: 'error', message: 'Permission check failed' }));
      return;
    }

    // Validate payload size (max 10MB per message)
    const payloadSize = JSON.stringify(syncData).length;
    if (payloadSize > WS_SYNC_DATA_MAX_BYTES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Payload too large (max 10MB)' }));
      return;
    }

    // Validate dataType is one of allowed types
    const allowedDataTypes = ['participants', 'squads', 'timeslots', 'all'];
    if (!allowedDataTypes.includes(dataType)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid dataType' }));
      return;
    }

    wsLogger.info({ deviceName: sourceClient.deviceName, dataType, payloadSize }, 'Données sync reçues');

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
        wsLogger.info({ targetDeviceName: targetClient.deviceName }, 'Données sync envoyées');
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
      wsLogger.info({ sentCount }, 'Données sync diffusées en broadcast');
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
      wsLogger.info('Serveur UDP découverte arrêté');
    }

    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      wsLogger.info('Serveur WebSocket Sync arrêté');
    }
  }
}

export const wsSyncServer = new WebSocketSyncServer();

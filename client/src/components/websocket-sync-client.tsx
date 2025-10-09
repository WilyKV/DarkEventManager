import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wifi, WifiOff, Users, Download, Upload, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConnectedClient {
  deviceId: string;
  deviceName: string;
  connectedAt: string;
}

interface WebSocketSyncClientProps {
  isMaster: boolean;
  deviceId: string;
  deviceName: string;
}

interface DiscoveredServer {
  ip: string;
  port: number;
  clients: number;
}

export function WebSocketSyncClient({ isMaster, deviceId, deviceName }: WebSocketSyncClientProps) {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastConnectedIPRef = useRef<string>('');

  const [isConnected, setIsConnected] = useState(false);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
  const [masterIP, setMasterIP] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<DiscoveredServer[]>([]);
  const [serverInfo, setServerInfo] = useState<{ ip: string; port: number } | null>(null);
  const [autoReconnect, setAutoReconnect] = useState(true);

  // Auto-connect if master
  useEffect(() => {
    if (isMaster) {
      // Master connects to localhost or current origin
      const host = window.location.hostname;
      connectToServer(host);
    }

    return () => {
      setAutoReconnect(false);
      disconnectFromServer();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [isMaster]);

  const scheduleReconnect = useCallback((ip: string) => {
    if (!autoReconnect) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Max 30 seconds
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connectToServer(ip);
    }, delay);
  }, [autoReconnect]);

  const connectToServer = useCallback(async (ip: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('Connection already in progress');
      return;
    }

    setIsConnecting(true);
    lastConnectedIPRef.current = ip;

    // Generate authentication token before connecting
    let authToken: string;
    try {
      // Determine the correct API endpoint based on connection type
      const isLocalhost = ip === 'localhost' || ip === window.location.hostname || ip === '127.0.0.1';
      const apiHost = isLocalhost ? '' : `http://${ip}:${window.location.port || '5000'}`;
      const tokenUrl = `${apiHost}/api/sync/ws-token`;

      console.log(`Requesting auth token from: ${tokenUrl}`);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get authentication token: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      authToken = data.token;
      console.log('Authentication token obtained');
    } catch (error) {
      console.error('Failed to get auth token:', error);
      setIsConnecting(false);
      toast({
        title: "Erreur d'authentification",
        description: error instanceof Error ? error.message : "Impossible d'obtenir le token d'authentification",
        variant: "destructive",
      });
      return;
    }

    // Determine the port to use
    let port = '5000'; // Default port

    // If connecting to the same host as the web app, use the same port
    const isLocalhost = ip === 'localhost' || ip === window.location.hostname || ip === '127.0.0.1';
    if (isLocalhost && window.location.port) {
      port = window.location.port;
    }

    // For WiFi Direct connections, always use HTTP (ws://) not HTTPS (wss://)
    // WiFi Direct networks typically don't have SSL certificates
    const isWifiDirect = ip.startsWith('192.168.49.') || ip.startsWith('192.168.43.') ||
                        ip.startsWith('172.') || (!isLocalhost && ip.startsWith('192.168.'));

    const protocol = isWifiDirect ? 'ws:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    const wsUrl = `${protocol}//${ip}:${port}/ws`;

    console.log(`Connecting to: ${wsUrl} (WiFi Direct: ${isWifiDirect})`);

    try {
      const ws = new WebSocket(wsUrl);
      let pingInterval: NodeJS.Timeout;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;

        // Register this device with authentication token
        ws.send(JSON.stringify({
          type: 'register',
          deviceId,
          deviceName,
          authToken,
        }));

        // Start ping/pong to keep connection alive
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        toast({
          title: "Connecté au serveur",
          description: `Connexion établie avec ${ip}`,
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle registration confirmation
          if (message.type === 'registered') {
            setIsConnected(true);
            console.log('✅ Successfully authenticated with server');
          }

          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        setConnectedClients([]);
        clearInterval(pingInterval);

        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        // Only show toast if not reconnecting automatically
        if (reconnectAttemptsRef.current === 0) {
          toast({
            title: "Déconnecté",
            description: "La connexion au serveur a été fermée",
          });
        }

        // Auto-reconnect if enabled
        if (autoReconnect && lastConnectedIPRef.current) {
          scheduleReconnect(lastConnectedIPRef.current);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnecting(false);
      toast({
        title: "Erreur",
        description: "Impossible de créer la connexion WebSocket",
        variant: "destructive",
      });

      // Retry on error
      if (autoReconnect) {
        scheduleReconnect(ip);
      }
    }
  }, [deviceId, deviceName, toast, autoReconnect, scheduleReconnect]);

  const disconnectFromServer = () => {
    setAutoReconnect(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setConnectedClients([]);
    }
  };

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'registered':
        console.log('Device registered:', message);
        if (message.serverIP && message.serverPort) {
          setServerInfo({ ip: message.serverIP, port: message.serverPort });
        }
        if (message.connectedClients) {
          setConnectedClients(message.connectedClients);
        }
        break;

      case 'client-list':
        setConnectedClients(message.clients || []);
        break;

      case 'sync-request':
        handleSyncRequest(message);
        break;

      case 'sync-data':
        handleSyncData(message);
        break;

      case 'pong':
        // Pong received, connection is alive
        break;

      case 'error':
        toast({
          title: "Erreur",
          description: message.message,
          variant: "destructive",
        });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const handleSyncRequest = (message: any) => {
    const { sourceDeviceName, requestType } = message;

    toast({
      title: "Demande de synchronisation",
      description: `${sourceDeviceName} demande une synchronisation de type: ${requestType}`,
    });

    // TODO: Implement sync request handling
    // This would prompt the user to accept/reject the sync request
    // and then gather the requested data to send back
  };

  const handleSyncData = (message: any) => {
    const { sourceDeviceName, dataType, data } = message;

    toast({
      title: "Données reçues",
      description: `Données de type ${dataType} reçues de ${sourceDeviceName}`,
    });

    // TODO: Implement data import logic
    // This would process the received data and import it into the local database
  };

  const requestSyncFrom = (targetDeviceId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Erreur",
        description: "Non connecté au serveur",
        variant: "destructive",
      });
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'sync-request',
      targetDeviceId,
      requestType: 'all', // participants, time-slots, squads, all
    }));
  };

  const sendDataTo = (targetDeviceId: string, dataType: string, data: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Erreur",
        description: "Non connecté au serveur",
        variant: "destructive",
      });
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'sync-data',
      targetDeviceId,
      dataType,
      syncData: data,
    }));

    toast({
      title: "Données envoyées",
      description: `Données de type ${dataType} envoyées`,
    });
  };

  const handleConnect = () => {
    if (!masterIP) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer l'adresse IP du serveur maître",
        variant: "destructive",
      });
      return;
    }

    setAutoReconnect(true);
    reconnectAttemptsRef.current = 0;
    connectToServer(masterIP);
  };

  const discoverServers = async () => {
    setIsDiscovering(true);
    setDiscoveredServers([]);

    // Try common local IPs for WiFi Direct and local networks
    const baseIP = window.location.hostname;
    const commonIPs = [
      baseIP,
      'localhost',
      '192.168.49.1',  // Android WiFi Direct
      '192.168.43.1',  // Alternative Android WiFi Direct
      '192.168.1.1',   // Common router
      '192.168.0.1',   // Alternative router
      '10.0.0.1',      // Some routers
    ];

    // Also try to detect local network range from hostname
    if (baseIP && baseIP.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const parts = baseIP.split('.');
      const baseNetwork = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
      if (!commonIPs.includes(baseNetwork)) {
        commonIPs.push(baseNetwork);
      }
    }

    const results: DiscoveredServer[] = [];
    const port = window.location.port || '5000';

    for (const ip of commonIPs) {
      try {
        // Determine if this looks like WiFi Direct
        const isWifiDirect = ip.startsWith('192.168.49.') || ip.startsWith('192.168.43.') ||
                            ip.startsWith('172.') || (!ip.includes('localhost') && ip.startsWith('192.168.'));

        const protocol = isWifiDirect ? 'ws:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
        const wsUrl = `${protocol}//${ip}:${port}/ws`;

        console.log(`Trying to discover server at: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout'));
          }, 3000); // Increased timeout for WiFi Direct

          ws.onopen = () => {
            clearTimeout(timeout);
            console.log(`Server discovered at: ${ip}`);
            results.push({ ip, port: parseInt(port), clients: 0 });
            ws.close();
            resolve(true);
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Connection failed'));
          };
        });
      } catch (error) {
        // Ignore errors, server not available at this IP
        console.log(`No server at ${ip}`);
      }
    }

    setDiscoveredServers(results);
    setIsDiscovering(false);

    if (results.length === 0) {
      toast({
        title: "Aucun serveur trouvé",
        description: "Veuillez entrer l'adresse IP manuellement (ex: 192.168.49.1)",
      });
    } else {
      toast({
        title: `${results.length} serveur(s) trouvé(s)`,
        description: "Sélectionnez un serveur pour vous connecter",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5" />}
          Synchronisation WebSocket
        </CardTitle>
        <CardDescription>
          {isMaster
            ? 'Serveur de synchronisation actif - Les autres appareils peuvent se connecter'
            : 'Connectez-vous au serveur maître pour synchroniser vos données'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                Connecté
              </Badge>
            ) : (
              <Badge variant="secondary">
                Déconnecté
              </Badge>
            )}
            {isConnecting && (
              <RefreshCw className="w-4 h-4 animate-spin" />
            )}
            {reconnectAttemptsRef.current > 0 && !isConnected && (
              <span className="text-xs text-muted-foreground">
                Tentative {reconnectAttemptsRef.current}...
              </span>
            )}
          </div>
          {!isMaster && !isConnected && (
            <div className="flex gap-2 items-center flex-wrap">
              <Input
                placeholder="Ex: 192.168.49.1"
                value={masterIP}
                onChange={(e) => setMasterIP(e.target.value)}
                className="w-48"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              />
              <Button onClick={handleConnect} disabled={isConnecting} size="sm">
                Connecter
              </Button>
              <Button
                onClick={discoverServers}
                disabled={isDiscovering}
                variant="outline"
                size="sm"
              >
                {isDiscovering ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Search className="w-3 h-3 mr-1" />
                )}
                Découvrir
              </Button>
            </div>
          )}
          {isConnected && !isMaster && (
            <Button onClick={disconnectFromServer} variant="outline" size="sm">
              Déconnecter
            </Button>
          )}
        </div>

        {/* Discovered Servers */}
        {discoveredServers.length > 0 && !isConnected && (
          <Alert>
            <Search className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Serveurs découverts</p>
              <div className="space-y-1">
                {discoveredServers.map((server) => (
                  <div key={server.ip} className="flex items-center justify-between">
                    <span className="text-sm font-mono">{server.ip}:{server.port}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMasterIP(server.ip);
                        setAutoReconnect(true);
                        connectToServer(server.ip);
                      }}
                    >
                      Connecter
                    </Button>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Master Server Info */}
        {isMaster && serverInfo && (
          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Serveur WebSocket actif</p>
              <p className="text-sm">Les autres appareils peuvent se connecter à :</p>
              <div className="mt-2 space-y-2">
                <div className="text-sm font-mono bg-muted p-3 rounded">
                  <div className="font-bold text-green-600 mb-1">Adresse IP :</div>
                  <div className="text-lg">{serverInfo.ip}</div>
                  {serverInfo.port && serverInfo.port !== '80' && (
                    <>
                      <div className="font-bold text-blue-600 mt-2 mb-1">Port :</div>
                      <div className="text-lg">{serverInfo.port}</div>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                📱 Sur les autres appareils : entrez cette adresse IP {serverInfo.ip} dans le champ de connexion
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                📶 Pour WiFi Direct : créez un hotspot WiFi sur cet appareil et connectez les autres appareils au hotspot
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Connected Clients (visible when connected) */}
        {isConnected && connectedClients.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" />
              <h4 className="font-semibold text-sm">
                Appareils connectés ({connectedClients.length})
              </h4>
            </div>

            <div className="space-y-2">
              {connectedClients.map((client) => (
                <div
                  key={client.deviceId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{client.deviceName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(client.connectedAt).toLocaleTimeString('fr-FR')}
                    </p>
                  </div>

                  {client.deviceId !== deviceId && isMaster && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestSyncFrom(client.deviceId)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Recevoir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement data selection and sending
                          toast({
                            title: "Fonctionnalité à venir",
                            description: "Sélection et envoi de données",
                          });
                        }}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Envoyer
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No clients connected */}
        {isConnected && connectedClients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun autre appareil connecté</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

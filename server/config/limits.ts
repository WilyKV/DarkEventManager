/**
 * Constantes de configuration numérique du serveur.
 *
 * Toutes les valeurs "magiques" du code serveur sont centralisées ici pour
 * faciliter leur compréhension et leur maintenance.
 *
 * Convention : les durées sont exprimées en millisecondes (ms), les tailles
 * en octets, les ports en entiers.
 */

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

/**
 * Taille maximale d'un message WebSocket accepté par le serveur (100 MB).
 * Nécessaire pour les transferts de données de synchronisation offline.
 */
export const WS_MAX_PAYLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Intervalle entre deux pings WebSocket envoyés au client (30 s).
 * Maintient la connexion vivante sur les réseaux peu fiables (WiFi, hotspot).
 */
export const WS_PING_INTERVAL_MS = 30 * 1000; // 30 s

/**
 * Port UDP utilisé pour la découverte automatique du serveur sur le réseau local.
 * Le client envoie "DARK_EVENT_DISCOVER" sur ce port en broadcast.
 */
export const UDP_DISCOVERY_PORT = 8888;

/**
 * Taille maximale du payload d'un message sync-data WebSocket (10 MB).
 * Contrôle applicatif indépendant du maxPayload réseau.
 */
export const WS_SYNC_DATA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Auth — rate limiting
// ---------------------------------------------------------------------------

/**
 * Fenêtre de temps du rate-limiter de connexion (15 min).
 * Partagée par le limiter staff et le limiter visiteur.
 */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min

/**
 * Nombre maximum de tentatives de connexion staff autorisées
 * par IP + username dans la fenêtre RATE_LIMIT_WINDOW_MS.
 */
export const RATE_LIMIT_STAFF_MAX = 5;

/**
 * Nombre maximum de tentatives de connexion visiteur autorisées
 * par IP dans la fenêtre RATE_LIMIT_WINDOW_MS.
 */
export const RATE_LIMIT_VISITOR_MAX = 10;

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

/**
 * Durée de vie maximale du cookie de session (24 h en ms).
 * Correspond au paramètre `maxAge` passé à express-session.
 */
export const SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 86 400 000 ms

// ---------------------------------------------------------------------------
// HTTP — body parser
// ---------------------------------------------------------------------------

/**
 * Limite de taille du body JSON pour l'endpoint de bulk-ingest d'events (10 MB).
 * Exprimée sous forme de chaîne pour l'API express.json({ limit }).
 */
export const BULK_INGEST_BODY_LIMIT = "10mb";

// ---------------------------------------------------------------------------
// Event ingest — validation
// ---------------------------------------------------------------------------

/**
 * Nombre maximum d'events acceptés dans un seul batch bulk-ingest.
 * Au-delà, le serveur répond 413.
 */
export const BULK_INGEST_BATCH_MAX = 500;

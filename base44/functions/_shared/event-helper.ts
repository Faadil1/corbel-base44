// CORBEL: Shared event-chain helper
// Implements deterministic event hashing with SHA256 for tamper detection

export interface EventPayload {
  operationId: string;
  eventType: string;
  actorUserId: string;
  previousState?: string;
  newState?: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string; // ISO timestamp
}

export interface LinkedEvent {
  eventId: string;
  previousEventHash: string | null;
  eventHash: string;
}

// Deterministic canonicalization: stable field order
function canonicalizePayload(payload: EventPayload): string {
  const canonical = {
    operationId: payload.operationId,
    eventType: payload.eventType,
    actorUserId: payload.actorUserId,
    previousState: payload.previousState || '',
    newState: payload.newState || '',
    message: payload.message,
    metadata: payload.metadata || {},
    createdAt: payload.createdAt
  };
  return JSON.stringify(canonical);
}

// Compute SHA256 hash using Web Crypto API (Deno-compatible)
export async function computeEventHash(previousHash: string | null, payload: EventPayload): Promise<string> {
  const canonicalPayload = canonicalizePayload(payload);
  const chainData = previousHash ? previousHash + canonicalPayload : canonicalPayload;

  // Use Web Crypto API (available in Deno)
  const encoder = new TextEncoder();
  const data = encoder.encode(chainData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Get the most recent event in the chain for an operation
export async function getLastEvent(client: any, operationId: string): Promise<any | null> {
  try {
    const events = await client.asServiceRole.entities.OperationalEvent.filter(
      { operationId },
      '-createdAt', // Sort descending by creation date
      1 // Get only the most recent
    );
    return events.length > 0 ? events[0] : null;
  } catch (error) {
    console.error('Error fetching last event:', error);
    return null;
  }
}

// Validate the entire event chain for tampering
export async function validateEventChain(client: any, operationId: string): Promise<{
  valid: boolean;
  reason: string;
  lastEventHash?: string;
}> {
  try {
    // Get all events for this operation in chronological order
    const allEvents = await client.asServiceRole.entities.OperationalEvent.filter(
      { operationId },
      'createdAt' // Sort ascending (oldest first)
    );

    if (allEvents.length === 0) {
      return { valid: true, reason: 'No events in chain' };
    }

    // Verify each event's hash and chain linkage
    let expectedPreviousHash: string | null = null;

    for (const event of allEvents) {
      const payload: EventPayload = {
        operationId: event.operationId,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        previousState: event.previousState,
        newState: event.newState,
        message: event.message,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString ? event.createdAt.toISOString() : String(event.createdAt)
      };

      // Recompute the event's hash
      const recomputedHash = await computeEventHash(expectedPreviousHash, payload);

      // Verify hash matches (if stored)
      if (event.eventHash && event.eventHash !== recomputedHash) {
        return {
          valid: false,
          reason: `Event ${event.id} hash mismatch: expected ${recomputedHash}, got ${event.eventHash}`
        };
      }

      // Verify previous hash linkage
      if (event.previousEventHash !== expectedPreviousHash) {
        return {
          valid: false,
          reason: `Event ${event.id} chain broken: expected previousHash ${expectedPreviousHash}, got ${event.previousEventHash}`
        };
      }

      // Update for next iteration
      expectedPreviousHash = recomputedHash;
    }

    return {
      valid: true,
      reason: 'Event chain verified',
      lastEventHash: expectedPreviousHash || undefined
    };
  } catch (error) {
    console.error('Error validating chain:', error);
    return {
      valid: false,
      reason: `Chain validation failed: ${String(error)}`
    };
  }
}

// Create and store a new event in the chain
export async function appendEvent(
  client: any,
  operationId: string,
  eventType: string,
  actorUserId: string,
  message: string,
  previousState?: string,
  newState?: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  try {
    // Get the last event in chain
    const lastEvent = await getLastEvent(client, operationId);
    const previousEventHash = lastEvent?.eventHash || null;

    // Create payload for new event
    const now = new Date().toISOString();
    const payload: EventPayload = {
      operationId,
      eventType,
      actorUserId,
      previousState,
      newState,
      message,
      metadata: metadata || {},
      createdAt: now
    };

    // Compute this event's hash
    const eventHash = await computeEventHash(previousEventHash, payload);

    // Store the event via service role (immutable once created)
    const event = await client.asServiceRole.entities.OperationalEvent.create({
      operationId,
      eventType,
      actorUserId,
      previousState,
      newState,
      message,
      metadata,
      previousEventHash,
      eventHash,
      createdAt: now
    });

    return event;
  } catch (error) {
    console.error('Error appending event:', error);
    return null;
  }
}

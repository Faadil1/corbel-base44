import { createClientFromRequest } from 'npm:@base44/sdk';

function errorResponse(e: string, r: string, s: number): Response {
  return new Response(JSON.stringify({ error: e, reason: r }), { status: s, headers: { 'Content-Type': 'application/json' } });
}

function successResponse(d: any, s: number = 200): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
}

async function computeEventHash(ph: string | null, p: any): Promise<string> {
  const c = { operationId: p.operationId, eventType: p.eventType, actorUserId: p.actorUserId, previousState: p.previousState || '', newState: p.newState || '', message: p.message, metadata: p.metadata || {}, createdAt: p.createdAt };
  const cd = ph ? ph + JSON.stringify(c) : JSON.stringify(c);
  const e = new TextEncoder();
  const h = await crypto.subtle.digest('SHA-256', e.encode(cd));
  const ha = Array.from(new Uint8Array(h));
  return ha.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateEventChain(client: any, operationId: string): Promise<any> {
  try {
    const allEvents = await client.asServiceRole.entities.OperationalEvent.filter({ operationId }, 'createdAt');
    if (allEvents.length === 0) return { valid: true, reason: 'No events in chain' };
    let expectedPreviousHash: string | null = null;
    for (const event of allEvents) {
      const p = {
        operationId: event.operationId,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        previousState: event.previousState,
        newState: event.newState,
        message: event.message,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString ? event.createdAt.toISOString() : String(event.createdAt)
      };
      const recomputedHash = await computeEventHash(expectedPreviousHash, p);
      if (event.eventHash && event.eventHash !== recomputedHash) {
        return { valid: false, reason: `Event ${event.id} hash mismatch` };
      }
      if (event.previousEventHash !== expectedPreviousHash) {
        return { valid: false, reason: `Event ${event.id} chain broken` };
      }
      expectedPreviousHash = recomputedHash;
    }
    return { valid: true, reason: 'Event chain verified', lastEventHash: expectedPreviousHash };
  } catch (error) {
    return { valid: false, reason: `Chain validation failed: ${String(error)}` };
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId } = body;

    if (!operationId) {
      return errorResponse('Bad Request', 'operationId required', 400);
    }

    let operation: any;
    try {
      operation = await client.asServiceRole.entities.Operation.get(operationId);
    } catch (e) {
      return errorResponse('NOT_FOUND', 'Operation not found', 404);
    }

    if (operation.currentState !== 'RELEASED') {
      return errorResponse('Conflict', `Cannot generate receipt: operation is in ${operation.currentState}, must be RELEASED`, 409);
    }

    const chainValidation = await validateEventChain(client, operationId);
    if (!chainValidation.valid) {
      return errorResponse('Conflict', `Event chain validation failed: ${chainValidation.reason}`, 409);
    }

    const allEvents = await client.asServiceRole.entities.OperationalEvent.filter({ operationId }, 'createdAt');
    if (allEvents.length === 0) {
      return errorResponse('Conflict', 'No events found for this operation', 409);
    }

    const eventChain = allEvents.map((e: any) => ({
      id: e.id,
      eventHash: e.eventHash,
      type: e.eventType
    }));

    const receiptData = {
      operationId,
      timestamp: new Date().toISOString(),
      eventChainLength: allEvents.length,
      finalEventHash: chainValidation.lastEventHash,
      releaseState: 'RELEASED'
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(receiptData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const receiptHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const receipt = await client.asServiceRole.entities.ReleaseReceipt.create({
      operationId,
      releaseStatus: 'RELEASED',
      eventChain: JSON.stringify(eventChain),
      receiptHash
    });

    const receiptDisplay = {
      receipt,
      operationDetails: {
        operationId: operation.id,
        operationName: operation.name,
        operationLocation: operation.location,
        finalState: operation.currentState
      },
      chainDetails: {
        totalEvents: allEvents.length,
        chainHash: chainValidation.lastEventHash
      },
      receiptDetails: {
        receiptHash,
        generatedAt: new Date().toISOString(),
        receiptName: 'TAMPER-EVIDENT OPERATIONAL RECEIPT'
      }
    };

    return successResponse({
      success: true,
      receipt: receiptDisplay,
      validation: { chainValid: true, tampering: 'NONE DETECTED' }
    });

  } catch (error) {
    console.error('generateReleaseReceipt error:', error);
    return errorResponse('Internal Server Error', String(error), 500);
  }
}

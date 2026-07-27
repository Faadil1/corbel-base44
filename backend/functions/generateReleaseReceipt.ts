// CORBEL: generateReleaseReceipt() - Creates immutable receipt showing the complete event chain
// Only callable when operation is in READY state

import { createClientFromRequest } from 'base44/sdk';
import * as crypto from 'crypto';

export async function generateReleaseReceipt(req: Request): Promise<Response> {
  try {
    const client = createClientFromRequest(req);
    const body = await req.json();
    const { operationId } = body;

    if (!operationId) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', reason: 'operationId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify operation exists and is in READY state
    const operation = await client.entities.read('Operation', operationId);
    if (operation.currentState !== 'READY') {
      return new Response(
        JSON.stringify({
          error: 'Conflict',
          reason: `Cannot generate receipt: operation is in ${operation.currentState}, must be READY`
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all operational events for this operation, ordered by creation time
    const events = await client.entities.filter('OperationalEvent', {
      operationId
    });

    // Sort events by createdAt (should be chronological)
    const sortedEvents = events.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });

    // Extract event IDs for the chain
    const eventChain = sortedEvents.map((e: any) => e.id);

    // Generate deterministic receipt hash from event chain
    const receiptData = {
      operationId,
      timestamp: new Date().toISOString(),
      eventChain
    };

    const receiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(receiptData))
      .digest('hex');

    // Create ReleaseReceipt record
    const receipt = await client.entities.create('ReleaseReceipt', {
      operationId,
      releaseStatus: 'RELEASED',
      eventChain: eventChain,
      receiptHash
    });

    // Prepare receipt display data with full event details
    const receiptDisplay = {
      receipt,
      events: sortedEvents.map((e: any) => ({
        id: e.id,
        eventType: e.eventType,
        actor: e.actorUserId,
        previousState: e.previousState,
        newState: e.newState,
        message: e.message,
        timestamp: e.createdAt
      })),
      summary: {
        operationName: operation.name,
        operationLocation: operation.location,
        finalState: operation.currentState,
        totalEvents: sortedEvents.length,
        receiptHash,
        generatedAt: new Date().toISOString()
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        receipt: receiptDisplay
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('generateReleaseReceipt error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

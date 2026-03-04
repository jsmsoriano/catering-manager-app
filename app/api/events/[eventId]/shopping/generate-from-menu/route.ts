import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/events/[eventId]/shopping/generate-from-menu
 * Generate shopping list items from the event menu. Body: { keepOverrides?: boolean }.
 * When using Supabase, load event menu and shopping list, run generation, persist items.
 * Current app uses localStorage; this stub returns 501 until Supabase is wired.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const keepOverrides = body?.keepOverrides !== false;

    // TODO: when using Supabase:
    // 1. Load event menu (event_menus or catering_event_menus by booking_id = eventId)
    // 2. Load shopping_lists for booking_id = eventId
    // 3. Call generateShoppingListFromMenu(eventId, list, keepOverrides)
    // 4. Upsert shopping_list_items (or update shopping_lists.items JSONB)
    // 5. Return updated list
    return NextResponse.json(
      {
        message: 'Shopping list is currently stored in localStorage; use "Generate From Menu" on the Event Shopping List page.',
        eventId,
        keepOverrides,
      },
      { status: 501 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

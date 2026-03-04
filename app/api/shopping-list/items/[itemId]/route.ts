import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/shopping-list/items/[itemId]
 * Update a shopping list item (override_qty, is_overridden, unit, unit_cost, notes, purchased).
 * When using Supabase, implement with update to shopping_list_items table.
 * Current app uses localStorage; this stub returns 501 until Supabase is wired.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  if (!itemId) {
    return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
  }

  try {
    const body = await _request.json();
    const allowed = [
      'overrideQty',
      'override_qty',
      'isOverridden',
      'is_overridden',
      'plannedUnit',
      'unit',
      'actualUnitCost',
      'unit_cost',
      'notes',
      'purchased',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      const normalized = key === 'override_qty' ? 'overrideQty' : key === 'is_overridden' ? 'isOverridden' : key === 'unit' ? 'plannedUnit' : key === 'unit_cost' ? 'actualUnitCost' : key;
      if (allowed.includes(normalized)) updates[normalized] = body[key];
    }

    // TODO: when using Supabase, update shopping_list_items set ... where id = itemId
    return NextResponse.json(
      { message: 'Shopping list is currently stored in localStorage; use the UI to edit.', itemId, updates },
      { status: 501 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

import { getTemplateConfig } from '@/lib/appSettings';
import { DEFAULT_TEMPLATE } from '@/lib/templateConfig';

// Public endpoint — no auth required. Returns only UI-facing template fields
// needed for the public inquiry form (event types, occasions, businessName).
export async function GET() {
  try {
    const config = await getTemplateConfig();
    return Response.json({
      businessName: config.businessName,
      eventTypes: config.eventTypes,
      occasions: config.occasions,
    });
  } catch {
    return Response.json({
      businessName: DEFAULT_TEMPLATE.businessName,
      eventTypes: DEFAULT_TEMPLATE.eventTypes,
      occasions: DEFAULT_TEMPLATE.occasions,
    });
  }
}

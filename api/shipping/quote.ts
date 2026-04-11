import { getShippingQuote } from '../_lib/shipping.js';

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  try {
    const quote = await getShippingQuote({
      city: (body.city as string) ?? null,
      zip: (body.zip as string) ?? null,
      lat: (body.lat as number) ?? null,
      lng: (body.lng as number) ?? null,
      street_address: (body.street_address as string) ?? null,
      suburb: (body.suburb as string) ?? null,
      entered_address: (body.entered_address as string) ?? null,
    });
    return Response.json(quote);
  } catch {
    return Response.json({ error: 'Failed to get shipping quote' }, { status: 500 });
  }
}

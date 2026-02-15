# API Documentation

> **Version**: 0.1.0
> **Last Updated**: 2026-02-12

---

## Pricing Calculation API

### `calculateCateringPrice()`

Calculates the total price for a catering event with detailed breakdown.

**Location**: `lib/moneyRules.ts`

#### Parameters

```typescript
interface PricingInput {
  adults: number;              // Number of adult guests
  children: number;            // Number of children under 13
  serviceType: ServiceType;    // 'delivery' | 'pickup' | 'full-service'
  eventDate: Date;             // Date of the event
  distanceMiles?: number;      // Distance for delivery (optional)
  baseRatePerPerson?: number;  // Override base rate (optional)
}

// Optional second parameter
config?: PricingConfig          // Custom pricing config (uses DEFAULT_PRICING if not provided)
```

#### Returns

```typescript
interface PricingBreakdown {
  adultCount: number;          // Number of adults
  adultRate: number;           // Rate per adult
  adultSubtotal: number;       // Total for adults
  childCount: number;          // Number of children
  childRate: number;           // Rate per child
  childSubtotal: number;       // Total for children
  guestSubtotal: number;       // Combined guest total
  serviceFee: number;          // Service type fee
  dateTimeSurcharge: number;   // Weekend surcharge
  distanceFee: number;         // Delivery distance fee
  subtotal: number;            // Before minimum
  minimumNotMet: boolean;      // Whether minimum was applied
  minimumCharge: number;       // Additional charge for minimum
  total: number;               // Final total
}
```

#### Usage Example

```typescript
import { calculateCateringPrice } from '@/lib/moneyRules';

const breakdown = calculateCateringPrice({
  adults: 30,
  children: 5,
  serviceType: 'delivery',
  eventDate: new Date('2026-03-15'),
  distanceMiles: 12,
});

console.log(breakdown.total); // Final price
```

---

### `formatCurrency()`

Formats a number as USD currency.

**Location**: `lib/moneyRules.ts`

#### Parameters

```typescript
amount: number  // Amount in dollars
```

#### Returns

```typescript
string  // Formatted currency string (e.g., "$1,234.56")
```

#### Usage Example

```typescript
import { formatCurrency } from '@/lib/moneyRules';

formatCurrency(1234.56);  // "$1,234.56"
formatCurrency(25);        // "$25.00"
```

---

### `getPricingSummary()`

Generates a human-readable pricing summary.

**Location**: `lib/moneyRules.ts`

#### Parameters

```typescript
breakdown: PricingBreakdown  // Result from calculateCateringPrice()
```

#### Returns

```typescript
string  // Summary string (e.g., "30 adults @ $25.00, 5 children @ $12.50 = $1,012.50 total")
```

#### Usage Example

```typescript
import { calculateCateringPrice, getPricingSummary } from '@/lib/moneyRules';

const breakdown = calculateCateringPrice({
  adults: 20,
  children: 0,
  serviceType: 'pickup',
  eventDate: new Date('2026-03-20'),
});

const summary = getPricingSummary(breakdown);
console.log(summary);
// "20 adults @ $25.00 = $500.00 total"
```

---

## Menu-Aware Pricing Helpers

### Revenue/Cost Overrides in Event Inputs

`calculateEventFinancials()` accepts optional menu-derived overrides:

```typescript
interface EventInput {
  // existing fields...
  subtotalOverride?: number;  // Override computed subtotal
  foodCostOverride?: number;  // Override percent-based food cost
}
```

When provided, downstream gratuity, labor, profit, and owner distributions are calculated from these override values.

### `calculateMenuPricingBreakdown()`

Calculates menu-derived subtotal and food cost from guest selections and menu item catalog data.

**Location**: `lib/menuPricing.ts`

### `buildMenuPricingSnapshot()`

Builds a booking-safe `menuPricingSnapshot` payload for persistent storage on a booking record.

**Location**: `lib/menuPricing.ts`

### `calculateBookingFinancials()`

Wrapper helper that computes booking financials and automatically applies `booking.menuPricingSnapshot` overrides when present.

**Location**: `lib/bookingFinancials.ts`

---

## Constants

### `DEFAULT_PRICING`

Default pricing configuration object.

**Location**: `lib/moneyRules.ts`

```typescript
export const DEFAULT_PRICING: PricingConfig = {
  baseRatePerPerson: 25.00,
  childDiscountPercent: 50,
  minimumOrder: 200.00,
  minimumGuests: 10,
  serviceFees: {
    pickup: 0,
    delivery: 50,
    fullService: 150,
  },
  weekendSurchargePercent: 15,
  distanceFeePerMile: 2.50,
  freeDeliveryRadius: 5,
};
```

---

## Types

### Type Definitions

All types are exported from `lib/types.ts`:

```typescript
export type ServiceType = 'delivery' | 'pickup' | 'full-service';

export interface PricingInput { /* ... */ }
export interface PricingBreakdown { /* ... */ }
export interface PricingConfig { /* ... */ }
```

See [lib/types.ts](../lib/types.ts) for complete type definitions.

---

## Future API Endpoints

When backend API routes are added, document them here:

### Planned Routes

- `POST /api/quotes` - Create and save a quote
- `GET /api/quotes/:id` - Retrieve a saved quote
- `POST /api/quotes/:id/email` - Email quote to customer
- `GET /api/pricing/config` - Get current pricing configuration
- `POST /api/orders` - Create an order from a quote

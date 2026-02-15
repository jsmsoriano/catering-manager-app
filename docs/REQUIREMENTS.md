# Catering App - Business Requirements

> **Last Updated**: 2026-02-15
> **Version**: 0.1.0

## Overview

A modern web application for catering price calculation and management.

---

## Pricing Model

### Base Pricing Structure

**Primary Model**: Per-person (headcount-based) pricing

| Guest Type | Base Rate | Notes |
|------------|-----------|-------|
| Adults | $25.00 | Standard rate |
| Children (under 13) | $12.50 | 50% discount applied |

### Service Types & Fees

| Service Type | Description | Fee |
|--------------|-------------|-----|
| Pickup | Customer picks up food | $0 |
| Delivery | Food delivered to location | $50 base fee |
| Full-Service | Complete setup and service | $150 base fee |

### Additional Pricing Factors

#### 1. Weekend Surcharge
- **Days**: Friday, Saturday, Sunday
- **Rate**: +15% on guest subtotal
- **Applies to**: All service types

#### 2. Distance Fees (Delivery Only)
- **Free delivery radius**: First 5 miles
- **Rate**: $2.50 per mile beyond free radius
- **Example**: 12 miles = $17.50 fee (7 miles × $2.50)

#### 3. Minimum Order Requirements
- **Minimum order total**: $200
- **Minimum guest count**: 10 guests
- **Enforcement**: Additional charge added if minimums not met

---

## Business Rules

### Rule 1: Child Discount Eligibility
```
IF guest age < 13 THEN
  rate = baseRate × 0.50
ELSE
  rate = baseRate
```

### Rule 2: Weekend Detection
```
IF eventDate.dayOfWeek IN [Friday, Saturday, Sunday] THEN
  apply weekendSurcharge = guestSubtotal × 0.15
```

### Rule 3: Distance Calculation
```
IF serviceType = "delivery" AND distance > 5 miles THEN
  distanceFee = (distance - 5) × $2.50
ELSE
  distanceFee = $0
```

### Rule 4: Minimum Order Enforcement
```
IF (subtotal < $200 OR totalGuests < 10) THEN
  minimumCharge = max(0, $200 - subtotal)
  total = subtotal + minimumCharge
```

---

## Calculation Flow

```
1. Calculate Guest Costs
   adultSubtotal = adults × $25.00
   childSubtotal = children × $12.50
   guestSubtotal = adultSubtotal + childSubtotal

2. Add Service Fee
   serviceFee = [based on service type]

3. Calculate Weekend Surcharge (if applicable)
   weekendSurcharge = guestSubtotal × 0.15

4. Calculate Distance Fee (if delivery)
   distanceFee = (miles - 5) × $2.50 [if miles > 5]

5. Calculate Subtotal
   subtotal = guestSubtotal + serviceFee + weekendSurcharge + distanceFee

6. Apply Minimum Order
   IF subtotal < $200 OR guests < 10:
     minimumCharge = $200 - subtotal

7. Calculate Total
   total = subtotal + minimumCharge
```

---

## Pricing Examples

### Example 1: Small Weekday Pickup
- **Guests**: 8 adults
- **Service**: Pickup
- **Date**: Tuesday

```
Adults:        8 × $25.00 = $200.00
Service Fee:              = $0.00
Subtotal:                 = $200.00
Minimum Met ✓
─────────────────────────────────
TOTAL:                    = $200.00
```

### Example 2: Weekend Wedding with Children
- **Guests**: 50 adults, 10 children
- **Service**: Full-service
- **Date**: Saturday
- **Distance**: N/A

```
Adults:       50 × $25.00 = $1,250.00
Children:     10 × $12.50 = $125.00
Guest Subtotal:           = $1,375.00
Service Fee (Full):       = $150.00
Weekend Surcharge (15%):  = $206.25
Subtotal:                 = $1,731.25
─────────────────────────────────
TOTAL:                    = $1,731.25
```

### Example 3: Weekday Delivery (Long Distance)
- **Guests**: 30 adults
- **Service**: Delivery
- **Date**: Wednesday
- **Distance**: 15 miles

```
Adults:       30 × $25.00 = $750.00
Service Fee (Delivery):   = $50.00
Distance (10 mi @ $2.50): = $25.00
Subtotal:                 = $825.00
─────────────────────────────────
TOTAL:                    = $825.00
```

---

## Future Considerations

### Planned Features
- [x] Menu item selection with per-item pricing (implemented for private-dinner bookings)
- [ ] Package deals and promotions
- [ ] Tax calculation based on location
- [ ] Holiday surcharge (beyond weekends)
- [ ] Gratuity/tip calculation
- [ ] Multi-tier guest count pricing
- [ ] Corporate discount codes
- [ ] Save and email quotes
- [ ] Order history and tracking

### Pricing Adjustments to Consider
- [ ] Time-of-day pricing (lunch vs. dinner)
- [ ] Seasonal adjustments
- [ ] Rush order fees (< 48 hours notice)
- [ ] Cancellation policies
- [ ] Deposit requirements

---

## Configuration

All pricing values are configurable in `lib/moneyRules.ts`:

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

## Notes

- All prices are in USD
- Prices are subject to change based on menu selection
- Final quotes should be confirmed with customer
- This calculator provides estimates only

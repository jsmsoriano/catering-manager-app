# Pricing Rules Version History

This document tracks changes to pricing rules over time for historical reference and auditing.

---

## Version 1.0.0 - Current (2026-02-12)

### Active Pricing Configuration

```typescript
{
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
}
```

### Rationale
- Initial pricing structure based on per-person model
- 50% child discount to encourage family events
- Weekend surcharge covers increased labor costs
- Distance fees cover actual delivery expenses

### Effective Date
- **From**: 2026-02-12
- **To**: Present

---

## Future Versions

When pricing changes, add new versions above this line with:
- Version number
- Date effective
- Changed values
- Reason for change
- Migration notes (if any)

### Version Template

```markdown
## Version X.Y.Z - (YYYY-MM-DD)

### Changes
- [Changed value]: [Old value] → [New value]

### Rationale
- Explanation of why the change was made

### Effective Date
- **From**: YYYY-MM-DD
- **To**: YYYY-MM-DD or "Present"
```

---

## Pricing Change Guidelines

When updating pricing:

1. **Update** `lib/moneyRules.ts` with new values
2. **Document** the change in this file
3. **Update** `CHANGELOG.md` with the version
4. **Update** `docs/REQUIREMENTS.md` if rules change
5. **Notify** customers of upcoming changes (if applicable)
6. **Test** calculator with new values
7. **Consider** grandfathering existing quotes

---

## Historical Quotes

For quotes generated with old pricing:
- Store the pricing version used with each quote
- Allow regenerating quotes with historical pricing
- Consider migration path for pending orders

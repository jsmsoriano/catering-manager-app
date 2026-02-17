# Documentation Index

Welcome to the Catering App documentation.

## 📚 Documentation Structure

### Project Documentation

- **[REQUIREMENTS.md](REQUIREMENTS.md)** - Business requirements, pricing model, and calculation examples
- **[API.md](API.md)** - API reference for pricing functions and types
- **[PRICING_VERSIONS.md](PRICING_VERSIONS.md)** - Historical pricing changes and version tracking
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Supabase environment, auth flow, and migration setup

### Root Level

- **[../CHANGELOG.md](../CHANGELOG.md)** - Version history and release notes
- **[../README.md](../README.md)** - Project overview and getting started

---

## 🗂️ Quick Links

### For Developers
- [API Reference](API.md) - Function documentation
- [Type Definitions](../lib/types.ts) - TypeScript interfaces
- [Pricing Logic](../lib/moneyRules.ts) - Core calculation code
- [Supabase Setup](SUPABASE_SETUP.md) - Auth/session and database baseline

### For Business/Product
- [Business Requirements](REQUIREMENTS.md) - Detailed pricing rules
- [Pricing Examples](REQUIREMENTS.md#pricing-examples) - Real-world scenarios
- [Pricing History](PRICING_VERSIONS.md) - Track rate changes

### For Project Management
- [Changelog](../CHANGELOG.md) - What's new
- [Future Features](REQUIREMENTS.md#future-considerations) - Roadmap items

---

## 📝 Updating Documentation

### When to Update Each File

| File | When to Update |
|------|----------------|
| `REQUIREMENTS.md` | Business rules or pricing model changes |
| `API.md` | New functions, parameters, or return values |
| `PRICING_VERSIONS.md` | Any pricing configuration change |
| `CHANGELOG.md` | Every release or significant change |

### Documentation Workflow

1. **Making Changes**
   - Update relevant documentation files
   - Include examples if adding new features
   - Update version numbers

2. **Pricing Changes**
   ```
   1. Update lib/moneyRules.ts
   2. Document in PRICING_VERSIONS.md
   3. Update REQUIREMENTS.md examples
   4. Add entry to CHANGELOG.md
   ```

3. **New Features**
   ```
   1. Implement feature
   2. Update API.md with usage
   3. Add to CHANGELOG.md
   4. Update REQUIREMENTS.md if business rules change
   ```

---

## 🔍 Documentation Standards

### Code Examples
- Include TypeScript types
- Show imports
- Provide realistic values
- Include expected output

### Business Rules
- Use clear IF/THEN statements
- Include mathematical formulas
- Provide calculation examples
- Show edge cases

### Versioning
- Follow [Semantic Versioning](https://semver.org/)
- Document breaking changes clearly
- Keep historical records

---

## 📊 Version Information

- **Current Version**: 0.1.0
- **Last Updated**: 2026-02-12
- **Pricing Version**: 1.0.0

---

## 🤝 Contributing

When adding features:
1. Update code
2. Update documentation
3. Add tests (when implemented)
4. Update CHANGELOG.md
5. Bump version numbers appropriately

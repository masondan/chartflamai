# Flam Family - Quick Reference Card

**Keep this handy while developing.** For details, see `FLAM_DESIGN_SYSTEM.md`.

---

## Color Palette (Quick Copy)

```css
:root {
  /* Brand */
  --accent-brand: #5422b0;           /* Primary purple */
  --color-brand-light: #f0e6f7;      /* Lavender highlight */
  
  /* Text */
  --text-primary: #1f1f1f;           /* Body text */
  --text-secondary: #777777;         /* Helper text */
  
  /* Background */
  --bg-main: #ffffff;                /* Main bg */
  --bg-surface: #f8f8f8;             /* Panel/card bg */
  
  /* Borders & Icons */
  --color-border: #e0e0e0;           /* Inactive */
  --color-border-active: #999999;    /* Active/focus */
  --color-icon-default: #777777;     /* Default icon */
  --color-icon-active: #5422b0;      /* Active icon */
}
```

---

## Typography

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| H1 | 1.5rem (24px) | 700 | Page title |
| H2 | 1.25rem (20px) | 700 | Section title |
| H3 | 1.125rem (18px) | 700 | Subtitle |
| Body | 1rem (16px) | 400 | Text, buttons, inputs |
| Small | 0.875rem (14px) | 400 | Helper, labels |

**Font Family**: System stack (Inter fallback)

---

## Spacing Scale

```css
--spacing-xs: 4–6px     /* Tight */
--spacing-sm: 8–10px    /* Small gaps */
--spacing-md: 16px      /* Default */
--spacing-lg: 20–24px   /* Large gaps */
--spacing-xl: 28–32px   /* Very large */
```

**Use tokens everywhere. No hardcoded values.**

---

## Border & Radius

| Style | Value | Usage |
|-------|-------|-------|
| Border | 1px solid | All borders |
| Radius SM | 4–6px | Inputs, small buttons |
| Radius MD | 8px | Buttons, containers |
| Radius LG | 12–16px | Cards, large containers |
| Radius Full | 50% | Circles |

---

## Buttons Cheat Sheet

### Primary Button (CTA)
```css
background: #5422b0;
color: #ffffff;
padding: 8–16px;
border-radius: 8px;
border: none;
```

### Secondary Button
```css
background: #f8f8f8;
color: #1f1f1f;
padding: 8–16px;
border-radius: 8px;
border: 1px solid #e0e0e0;
```

### Active State
```css
background: #555555;
color: #ffffff;
```

### Disabled
```css
opacity: 0.5;
cursor: not-allowed;
```

---

## Form Inputs

```css
border: 1px solid #e0e0e0;    /* Default */
border: 1px solid #999999;    /* Focus */
padding: 8–16px;
border-radius: 8px;
background: #ffffff;
min-height: 48px;             /* Touch-friendly */
```

---

## Header

- **Height**: 56px
- **Padding**: 16px
- **Background**: #ffffff
- **Border Bottom**: 1px solid #999999 (optional)
- **Logo**: 32–36px height
- **Nav Icons**: 36–38px circles, 20–24px icons inside

---

## Mobile-First Breakpoints

```css
Mobile (default)    < 480px
Tablet/Desktop      ≥ 768px
```

**Max app width on desktop**: 480px (centered with margin: 0 auto)

---

## Icons

| Context | Size | Default Color | Active |
|---------|------|--------------|--------|
| Header Nav | 20–24px | #1f1f1f | #ffffff on #5422b0 |
| Buttons | 18–24px | #1f1f1f | #ffffff on #555555 (toggle) or #5422b0 (primary) |
| Lists | 16–20px | #1f1f1f | #ffffff on #5422b0 |
| Disabled | — | #999999 (50% opacity) | N/A |
| **Implementation** | SVG preferred | Scalable & colorable | — |

---

## Z-Index Layers

```css
auto              /* Normal content */
50–100            /* Dropdowns */
100               /* Header */
200               /* Modal overlay */
210               /* Modal/drawer */
220               /* Tooltip */
```

---

## Accessibility Checklist

- ✓ Semantic HTML (`<button>`, `<nav>`, `<form>`, etc.)
- ✓ Keyboard navigation (Tab, Enter, Escape)
- ✓ Focus visible (outline or ring)
- ✓ ARIA labels on unlabeled buttons
- ✓ Text contrast ≥ 4.5:1 (WCAG AA)
- ✓ Touch targets ≥ 44px

---

## Common Mistakes to Avoid

| ❌ Don't | ✓ Do |
|----------|------|
| Hardcode colors | Use CSS variables |
| Hardcode spacing (12px, 18px) | Use spacing scale |
| Use custom border radius (10px, 15px) | Use token (4, 8, 12, 16px) |
| Arbitrary font sizes (13px, 17px) | Use size scale (xs, sm, base, lg, xl) |
| 2px or 3px borders | Use 1px solid borders |
| Yellow or other CTAs (ChartFlam exception) | Use #5422b0 purple |
| Touch targets < 44px | Ensure 44–48px minimum |
| No focus state | Always show keyboard focus |
| Hardcoded shadows | Use token (sm, md, lg) if needed |

---

## Exception: ChartFlam Only

- Primary CTA button color: `#FFD700` (yellow) instead of purple
- Rationale: Visual prominence for chart actions
- All other styling follows core system

---

## Need More Detail?

See the full **FLAM_DESIGN_SYSTEM.md** for:
- Complete color palette with semantic meanings
- Typography hierarchy & font choices
- Comprehensive component patterns
- Accessibility guidelines
- Implementation checklist

Use **FLAM_AUDIT_CHECKLIST.md** to audit individual apps against this system.

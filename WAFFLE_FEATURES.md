# Waffle Chart Features & Capabilities

## Quick Start Example

### Input CSV
```
Elections,62,#6A5ACD
Valid Ballots,28,#FFDAB9
Contested,8,#66C0B4
Spoiled,2,#E6E6FA
```

### Output Options

#### 1. **Square Grid (Classic Waffle)**
- 10×10 grid of colored squares
- Perfect for percentages (each square = 1%)
- Clean, professional look
- Gap control for visual separation

#### 2. **Circle Grid**
- Circular cells instead of squares
- More organic feel
- Same grid structure
- Gaps make it feel less tight

#### 3. **Diamond Grid**
- Rotated square diamonds
- Geometric/modern aesthetic
- Creates interesting visual patterns
- Good for highlighting data

#### 4. **Hexagon Grid**
- True hexagonal tessellation
- Scientific/technical appearance
- Space-efficient (hexagons pack better)
- Most visually sophisticated

#### 5. **Floating Layout**
- Same cells but randomly scattered
- Background visible between cells
- Artistic rather than precise
- Good for "soft" visualizations where exact positions don't matter

## Control Examples

### Data
```
✓ Parse CSV (automatic color extraction)
✓ Manual color picking (color dialog)
✓ Add up to 4 categories
✓ Real-time grid size calculation
✓ Value range: 1-100 per category
```

### Styling
```
Shapes:        Square | Circle | Diamond | Hexagon
Layout:        Grid | Floating
Grid Size:     5-20 rows/columns
Cell Gap:      0-12px
Rounding:      0-8px (for squares)
Background:    White | Transparent
```

### Typography
```
Title:
  - Font: Inter, Playfair Display, Georgia
  - Size: 12-48px
  - Weight: Normal | Bold
  - Align: Left | Center | Right
  - Color: Any color via picker

Caption:
  - Same controls as title
  - Multi-line support
```

### Export
```
Format:    PNG (1080×variable height)
Quality:   Publication-ready
Includes:  Title + Chart + Caption
```

## Real-World Use Cases

### 1. **Election Results**
```
Democratic,42,#0066CC
Republican,38,#CC0000
Independent,15,#FFB81C
Other,5,#999999
→ Grid shows voting distribution at a glance
```

### 2. **Survey Responses**
```
Strongly Agree,35,#10B981
Agree,40,#D1FAE5
Neutral,15,#9CA3AF
Disagree,8,#FCA5A5
→ Floating layout for softer tone
```

### 3. **Budget Breakdown**
```
Personnel,45,#6A5ACD
Operations,30,#FFDAB9
Equipment,15,#66C0B4
Other,10,#E6E6FA
→ Hexagons for technical/financial angle
```

### 4. **Gender Distribution (Any Context)**
```
Female,55,#FF69B4
Male,42,#4169E1
Other,3,#999999
→ Diamond shapes for modern, inclusive feel
```

## Comparison: Why Waffle Charts?

| Aspect | Pie Chart | Bar Chart | Waffle Chart |
|--------|-----------|-----------|-------------|
| **Readability** | Hard to read | Easy | Very easy |
| **Space Efficiency** | High space use | Moderate | Efficient |
| **Precision** | ±5% error margin | High precision | 1% accuracy |
| **Pattern Recognition** | Hard to see small slices | Good | Excellent |
| **Mobile-Friendly** | Poor (text overlap) | Good | Excellent |
| **Discrete Values** | Works but awkward | Works well | Perfect |
| **Visual Appeal** | Traditional | Standard | Modern |

## Advanced Tricks

### Achieving Specific Effects

**"Completion Progress"**
- Use two categories (completed/remaining)
- Square shape, 10×10 grid
- White background

**"Demographic Breakdown"**
- Up to 4 categories
- Circle shapes
- Floating layout (organic feel)

**"Technical/Scientific"**
- Hexagon shapes
- Tight grid (low gap)
- Large chart size

**"Modern Design"**
- Diamonds
- Grid layout
- Color gradient (via CSS later)

## Data Format Rules

### Minimum Requirements
- **Label**: Any text (category name)
- **Value**: Integer 1-100
- **Color**: Optional (auto-selected if omitted)

### Examples
```
✓ Label,25
✓ Label,25,#FF0000
✓ Category A,50,#ABC123
✗ Label,abc         (invalid: not a number)
✗ Label,-5          (invalid: negative)
✗ Label,999         (invalid: too large, recalibrates grid)
```

## Output Quality

### PNG Export Features
- **Resolution**: 1080px width (2× screen resolution)
- **Height**: Auto-calculated based on content
- **DPI**: Web-optimized
- **Size**: ~50-200KB (depending on complexity)

### Perfect For
- Web articles
- Social media posts
- Reports
- Presentations
- Printed materials

## Limitations & Workarounds

| Limitation | Reason | Workaround |
|------------|--------|-----------|
| Max 4 categories | UI clarity | Combine smaller categories as "Other" |
| Fixed 1080px width | Consistency | Edit PNG in Figma if aspect ratio needed |
| No animations | Static PNG | Animated version could be added later |
| Floating layout is random | Artistic choice | Use grid layout for precise positioning |
| No custom fonts | App consistency | Use provided font choices |

## Future Enhancement Ideas

If this moves to production:

1. **Legends**: Add automatic legend below chart
2. **More Shapes**: Triangles, stars, custom SVGs
3. **Tighter Grid**: Allow 15×15, 20×20 for bigger data
4. **Animated GIF Export**: Show fill animation
5. **Template Presets**: "News", "Academic", "Social Media" styling
6. **Batch Export**: Generate multiple versions at once
7. **Custom Fonts**: Upload TTF files
8. **Accessibility**: Datavis-compliant color palettes

---

**Current Status**: Test/Prototype (ready for journalist testing)  
**Time to Add**: ~30 minutes for a journalist to learn  
**Time to Remove**: ~5 minutes (3 files, no ripple effects)

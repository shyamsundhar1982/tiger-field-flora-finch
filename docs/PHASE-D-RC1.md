# Phase D — RC1 Release Checklist

## Brand
- Parent identity: Vayu Shastr Pvt. Ltd.
- Consumer identity: Vyndi
- Product/platform identity: VELOXIS
- Carbon venture: Vyndi · Carbon Venture
- Aluminium venture: Aluminium Bicycle Venture
- Primary tagline: Wind, rendered in carbon.
- Engineering narrative retained: The Engineering Behind the Ride / Not just a frame. A flight plan for the road.

## UX
- Desktop Command navigation remains grouped by management domain.
- Mobile Command navigation remains horizontally accessible without layout overflow.
- Native configuration controls remain dropdown/select based where choices are constrained.
- Visible controls retain keyboard focus states and accessible labels.
- Reduced-motion preference is respected.
- Global form focus no longer uses glow/box-shadow effects.

## Integrity
- Phase A financial architecture remains authoritative.
- Phase B regression suite remains in npm test.
- Phase C venture scope remains explicit across Control Tower, Board and Decision Engine.
- Aluminium and Carbon remain separately identifiable in operating and financial views.

## Release gate
- Run the existing regression suite.
- Build once from the complete Phase D bundle.
- Verify the deployed RC1 on desktop and mobile.
- Confirm no console/runtime errors on primary public and Command routes.
- Confirm no stale accented `VéLOXIS` branding remains in visible surfaces targeted by the brand audit.

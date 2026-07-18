# Phase 5.2 UI fixes design

## Scope

Apply the reported fixes to the web app and to equivalent mobile flows:

- Remove browser number-input spinner controls across the web app.
- Make dropdown controls visually consistent with the Calm Teal design system.
- Restore readable dark-mode chart content and marks on expenses.
- Align Accounts and Categories form controls.
- Replace default CSV file-input chrome with an intentional upload control while preserving native file semantics.
- Hide or disable INR FX-rate controls and submit a neutral/null rate for INR.

## Design

### Web form controls

The existing shared `Input` and `SelectField` primitives are the central integration points. Number inputs will receive a shared spinner-suppression rule. `SelectField` will use a local accessible listbox primitive with a padded chevron, surface-colored menu, selected checkmark, keyboard navigation, Escape handling, and outside-click dismissal. Existing direct `<select>` elements in portfolio forms and portfolio import will use the same primitive so the web experience is consistent.

### Mobile form controls

Mobile will retain the existing segmented control for short visible choices. Equivalent text-based currency and asset-type selectors will use a reusable mobile choice control where the current implementation is a free-form `TextInput`. Mobile number entry already uses keyboard-specific `TextInput` props, so no browser-spinner change is required there.

### Upload control

The CSV import component will expose a styled button-like label with an upload icon and selected filename/status. A visually hidden native file input remains in the DOM, accepts CSV files, and is activated by the label so keyboard and assistive technology behavior remain intact.

### Charts

Web Recharts tooltips, legends, axes, grid, cursor, and marks will receive explicit semantic token colors. Mobile chart marks will use the same semantic color roles rather than fixed colors chosen without regard to dark mode. Chart labels and legends must remain readable in both themes.

### FX-rate behavior

For valuation, holding, and holding-event forms on both platforms, FX rate is relevant only for non-INR currency. The control is hidden while currency is INR, reappears for other currencies, and submitted data uses `null` for INR. Existing non-INR values remain available when switching back to a foreign currency.

## Testing and verification

- Add focused tests for the FX-rate visibility/submission rule and any extracted control helpers that can be tested without a browser.
- Run focused tests first and confirm they fail before implementation.
- Run web and mobile typechecks and lint.
- Run the repository build and test suites.
- Perform a browser smoke check for web dropdowns, upload activation, dark-mode charts, aligned forms, and INR/non-INR FX behavior when the local preview is available.

## Constraints

- Preserve the existing token package and semantic color roles; do not introduce isolated color literals for web charts.
- Avoid adding a UI dependency unless the existing project-local primitive proves insufficient.
- Keep the current import and persistence behavior unchanged.

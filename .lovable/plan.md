Plan to fix the spacing bug:

1. Fix the actual layout bug in `StudyPreviewer.tsx`
   - The hidden retro monitor layer is intended to become `position: absolute` when a study tool opens.
   - However, it currently has an inline `style={{ position: "relative" }}` which overrides the `.sa-stage-overlay { position: absolute }` CSS class.
   - That means the invisible retro monitor still occupies normal page space, and the modern viewer renders below it, causing the huge blank gap.
   - I’ll make the retro layer `position: absolute` only when `activeTool` is set, and `position: relative` only when the terminal is the visible in-flow layer.

2. Keep the monitor anchored in the same section position
   - The retro monitor and modern viewer will share the same `.sa-stage` frame correctly.
   - Clicking a study tool will crossfade the terminal out and viewer in at the same top position, instead of stacking the viewer below an invisible terminal.

3. Tighten transition height behavior
   - Keep the short height lock, but ensure it only prevents collapse/jump during the swap and does not create extra vertical space.
   - If needed, switch from `minHeight` to a more precise temporary `height`/`minHeight` strategy only during the 100–200ms transition window.

4. Verify the flow in the preview
   - On `/`, select a chapter, click “Practice Problem Helper,” and confirm:
     - no large blank gap appears,
     - the monitor stays in the same place,
     - the transition remains instant/subtle,
     - the loading skeleton/iframe appears inside the same frame.
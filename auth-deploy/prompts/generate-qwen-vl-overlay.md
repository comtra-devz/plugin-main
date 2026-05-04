# Qwen VL overlay (screenshot flows)

You receive a screenshot plus context. Work in two internal phases: (1) read visual hierarchy, sections, components, typography from the image; (2) emit the Comtra action plan JSON that reflects that layout using **only** components and variables from the DS context index in the system message.

The screenshot is the visual reference; every INSTANCE_COMPONENT must map to a real entry in the DS index. Do not invent components.

Output: **only** the single JSON action plan object, same schema as the main Comtra contract below. No separate visual description in the output.

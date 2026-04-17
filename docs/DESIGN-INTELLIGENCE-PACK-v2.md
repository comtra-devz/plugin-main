# Design Intelligence Pack
**Version:** 2.0
**Target:** Comtra Generate Engine
**Language:** English
**Produced by:** COMTRA by Ben & Cordiska

---

## HOW TO READ THIS DOCUMENT

This pack is the **Design Brain** of the Comtra Generate Engine. It operates at three levels:

1. **Archetype layer** — recognizes what kind of screen the user wants
2. **Structure layer** — defines how that screen is assembled (patterns, slots, spacing)
3. **Execution layer** — tells the plugin exactly how to apply properties, resolve ambiguity, and handle gaps

Sections are ordered by dependency: each section references the ones above it. The engine should load them in sequence.

**Integration with DS Import Wizard:**
Several fields in this pack are marked `[WIZARD_OVERRIDE]`. This means the DS Import Wizard may supply a richer or DS-specific value at runtime. When a `[WIZARD_OVERRIDE]` value is available, it always wins over the pack default. The pack provides the fallback intelligence when wizard data is absent or incomplete.

**Integration with Conversational UX:**
Fields marked `[CONV_UX]` are directly consumed by the conversational interface. They define suggested questions, disambiguation prompts, and clarification strategies that the UI should surface when the engine detects ambiguity.

---

## SECTION 1 — `meta`

```json
{
  "meta": {
    "pack_version": "2.0",
    "target_product": "comtra_generate",
    "language": "en",
    "schema_compatibility": "comtra_generate_v1+",
    "archetype_count": 22,
    "layout_pattern_count": 28,
    "slot_definition_count": 42,
    "notes_for_engineers": "All regex patterns use case-insensitive matching by default ((?i) prefix). Spacing values are in px. All archetype IDs are snake_case. WIZARD_OVERRIDE fields must be checked before applying pack defaults. This pack is designed to be versioned: increment pack_version when archetypes or slot_definitions change. The learning_loop section defines how quality signals feed back into this file."
  }
}
```

---

## SECTION 2 — `archetype_registry`

The archetype registry is the master dictionary of all screen types the Generate Engine can produce. Every prompt the user submits must resolve to exactly one archetype before generation begins.

Archetypes are grouped into families. Within a family, archetypes share structural assumptions (e.g. all `auth` family screens avoid complex navigation).

### 2.1 Family: Auth & Identity

```json
{
  "archetype_registry": {
    "login": {
      "id": "login",
      "family": "auth",
      "display_name": "Login / Sign In",
      "description": "A screen where the user authenticates with existing credentials.",
      "default_layout_pattern": "auth_login_mobile",
      "default_layout_pattern_desktop": "auth_login_desktop",
      "complexity_range": [3, 7],
      "viewport_primary": "mobile",
      "tov_register": "confident, minimal, trustworthy",
      "wizard_override_fields": ["tov_register", "brand_voice"],
      "typical_component_count": { "min": 4, "max": 8 },
      "forbidden_archetypes_in_same_frame": ["register", "onboarding_step", "dashboard_home"],
      "required_slots": ["email_input", "password_input", "primary_cta"],
      "common_optional_slots": ["brand_logo", "title_block", "secondary_action", "social_auth", "form_error_message"],
      "never_use_components_matching": ["(?i)step.*indicator", "(?i)progress.*bar", "(?i)tab.*bar", "(?i)data.*table", "(?i)card.*list"],
      "inference_confidence_boost": 1.5
    },

    "register": {
      "id": "register",
      "family": "auth",
      "display_name": "Register / Sign Up",
      "description": "A screen for creating a new account. May be single-step or the first step of a multi-step flow.",
      "default_layout_pattern": "auth_register_mobile",
      "default_layout_pattern_desktop": "auth_register_desktop",
      "complexity_range": [4, 10],
      "viewport_primary": "mobile",
      "tov_register": "welcoming, encouraging, low-friction",
      "wizard_override_fields": ["tov_register", "brand_voice"],
      "typical_component_count": { "min": 5, "max": 12 },
      "forbidden_archetypes_in_same_frame": ["login"],
      "required_slots": ["primary_cta"],
      "common_optional_slots": ["brand_logo", "title_block", "name_input", "email_input", "password_input", "confirm_password_input", "phone_input", "terms_checkbox", "secondary_action", "social_auth"],
      "never_use_components_matching": ["(?i)step.*indicator(?!.*register)", "(?i)data.*table", "(?i)sidebar"]
    },

    "forgot_password": {
      "id": "forgot_password",
      "family": "auth",
      "display_name": "Forgot Password / Reset",
      "description": "Password recovery flow, typically just an email input and submit.",
      "default_layout_pattern": "auth_forgot_password_mobile",
      "complexity_range": [2, 4],
      "viewport_primary": "mobile",
      "tov_register": "reassuring, calm, clear",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 3, "max": 5 },
      "required_slots": ["email_input", "primary_cta"],
      "common_optional_slots": ["title_block", "description_block", "back_navigation"],
      "never_use_components_matching": ["(?i)password.*input", "(?i)tab.*bar", "(?i)data.*table"]
    },

    "onboarding_step": {
      "id": "onboarding_step",
      "family": "auth",
      "display_name": "Onboarding Step",
      "description": "A single step within an onboarding carousel or wizard. Focus on one concept or action per screen.",
      "default_layout_pattern": "onboarding_step_mobile",
      "default_layout_pattern_desktop": "onboarding_step_desktop",
      "complexity_range": [2, 5],
      "viewport_primary": "mobile",
      "tov_register": "friendly, progressive, motivating",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 3, "max": 6 },
      "required_slots": ["title_block", "primary_cta"],
      "common_optional_slots": ["illustration_placeholder", "description_block", "step_indicator", "skip_action", "brand_logo"],
      "never_use_components_matching": ["(?i)form.*field.*multiple", "(?i)data.*table", "(?i)sidebar"]
    },

    "email_verification": {
      "id": "email_verification",
      "family": "auth",
      "display_name": "Email Verification",
      "description": "Asks the user to verify their email. Often shows a code input or a waiting state.",
      "default_layout_pattern": "auth_verification_mobile",
      "complexity_range": [2, 4],
      "viewport_primary": "mobile",
      "tov_register": "clear, reassuring",
      "typical_component_count": { "min": 3, "max": 6 },
      "required_slots": ["title_block", "description_block", "primary_cta"],
      "common_optional_slots": ["otp_input", "resend_action", "illustration_placeholder"],
      "never_use_components_matching": ["(?i)tab.*bar", "(?i)sidebar", "(?i)data.*table"]
    },

    "pin_biometric": {
      "id": "pin_biometric",
      "family": "auth",
      "display_name": "PIN / Biometric Unlock",
      "description": "Quick-access authentication via PIN, Face ID, or fingerprint.",
      "default_layout_pattern": "auth_pin_mobile",
      "complexity_range": [2, 5],
      "viewport_primary": "mobile",
      "tov_register": "secure, fast, minimal",
      "typical_component_count": { "min": 3, "max": 6 },
      "required_slots": ["title_block", "pin_input"],
      "common_optional_slots": ["biometric_trigger", "cancel_action", "brand_logo"],
      "never_use_components_matching": ["(?i)form.*multi", "(?i)tab.*bar", "(?i)sidebar"]
    }
  }
}
```

### 2.2 Family: Navigation & Shell

```json
{
  "archetype_registry": {
    "home_dashboard": {
      "id": "home_dashboard",
      "family": "navigation",
      "display_name": "Home / Dashboard",
      "description": "The main screen of the app after authentication. Typically shows overview, KPIs, or a curated feed.",
      "default_layout_pattern": "dashboard_mobile",
      "default_layout_pattern_desktop": "dashboard_desktop",
      "complexity_range": [5, 16],
      "viewport_primary": "both",
      "tov_register": "informative, direct, at-a-glance",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 6, "max": 20 },
      "required_slots": ["page_title"],
      "common_optional_slots": ["greeting_block", "kpi_card", "quick_actions", "activity_feed", "notification_badge", "bottom_nav_bar", "top_app_bar", "sidebar_nav"],
      "never_use_components_matching": ["(?i)login.*form", "(?i)register.*form"]
    },

    "bottom_nav_shell": {
      "id": "bottom_nav_shell",
      "family": "navigation",
      "display_name": "Bottom Navigation Shell",
      "description": "A screen template anchored by a persistent bottom navigation bar. Content zone varies by active tab.",
      "default_layout_pattern": "shell_bottom_nav_mobile",
      "complexity_range": [3, 8],
      "viewport_primary": "mobile",
      "tov_register": "neutral, structural",
      "typical_component_count": { "min": 3, "max": 10 },
      "required_slots": ["bottom_nav_bar", "content_area"],
      "common_optional_slots": ["top_app_bar", "fab_button", "page_title"],
      "never_use_components_matching": ["(?i)sidebar"]
    },

    "sidebar_shell": {
      "id": "sidebar_shell",
      "family": "navigation",
      "display_name": "Sidebar Navigation Shell",
      "description": "Desktop layout with persistent left-side navigation. Content zone fills the remaining area.",
      "default_layout_pattern": "shell_sidebar_desktop",
      "complexity_range": [4, 12],
      "viewport_primary": "desktop",
      "tov_register": "neutral, structural",
      "typical_component_count": { "min": 5, "max": 16 },
      "required_slots": ["sidebar_nav", "content_area", "top_app_bar"],
      "common_optional_slots": ["breadcrumb", "user_avatar_menu", "search_input", "notification_icon"],
      "never_use_components_matching": ["(?i)bottom.*nav"]
    },

    "tab_bar_shell": {
      "id": "tab_bar_shell",
      "family": "navigation",
      "display_name": "Top Tab Bar Shell",
      "description": "A screen with a horizontal scrollable or fixed tab bar at the top. Each tab shows a different content section.",
      "default_layout_pattern": "shell_tab_bar_mobile",
      "default_layout_pattern_desktop": "shell_tab_bar_desktop",
      "complexity_range": [3, 10],
      "viewport_primary": "both",
      "tov_register": "neutral, categorical",
      "typical_component_count": { "min": 4, "max": 14 },
      "required_slots": ["tab_bar", "content_area"],
      "common_optional_slots": ["top_app_bar", "search_input", "filter_bar"]
    }
  }
}
```

### 2.3 Family: Content & Feed

```json
{
  "archetype_registry": {
    "list_feed": {
      "id": "list_feed",
      "family": "content",
      "display_name": "List / Feed",
      "description": "A scrollable list of items. Can be a news feed, product list, inbox, search results, or any repeating-item pattern.",
      "default_layout_pattern": "list_feed_mobile",
      "default_layout_pattern_desktop": "list_feed_desktop",
      "complexity_range": [3, 10],
      "viewport_primary": "both",
      "tov_register": "scannable, efficient",
      "typical_component_count": { "min": 4, "max": 12 },
      "required_slots": ["list_item"],
      "common_optional_slots": ["top_app_bar", "search_input", "filter_bar", "sort_control", "empty_state", "list_section_header", "fab_button", "pagination_control"],
      "repeatable_slots": ["list_item", "list_section_header"],
      "never_use_components_matching": ["(?i)auth.*form", "(?i)login"]
    },

    "detail_view": {
      "id": "detail_view",
      "family": "content",
      "display_name": "Detail / Item View",
      "description": "A full-screen view of a single item — product, article, profile, event, etc.",
      "default_layout_pattern": "detail_view_mobile",
      "default_layout_pattern_desktop": "detail_view_desktop",
      "complexity_range": [4, 14],
      "viewport_primary": "both",
      "tov_register": "focused, informative",
      "typical_component_count": { "min": 5, "max": 18 },
      "required_slots": ["detail_header", "content_body"],
      "common_optional_slots": ["back_navigation", "hero_image", "metadata_block", "tag_list", "action_bar", "related_items", "comments_section", "sticky_cta_bar"],
      "never_use_components_matching": ["(?i)login.*form"]
    },

    "empty_state": {
      "id": "empty_state",
      "family": "content",
      "display_name": "Empty State",
      "description": "A screen or section shown when there is no content to display. Should explain why and guide the user to the next action.",
      "default_layout_pattern": "empty_state_centered",
      "complexity_range": [2, 4],
      "viewport_primary": "both",
      "tov_register": "encouraging, empathetic, clear",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 2, "max": 5 },
      "required_slots": ["illustration_placeholder", "title_block"],
      "common_optional_slots": ["description_block", "primary_cta", "secondary_action"],
      "never_use_components_matching": ["(?i)data.*table", "(?i)list.*item.*multiple"]
    },

    "article_reader": {
      "id": "article_reader",
      "family": "content",
      "display_name": "Article / Long-form Reader",
      "description": "Long-form content consumption screen. Typography-heavy, minimal chrome, focus on reading.",
      "default_layout_pattern": "article_reader_mobile",
      "default_layout_pattern_desktop": "article_reader_desktop",
      "complexity_range": [3, 8],
      "viewport_primary": "both",
      "tov_register": "editorial, clear",
      "typical_component_count": { "min": 4, "max": 10 },
      "required_slots": ["article_header", "article_body"],
      "common_optional_slots": ["back_navigation", "author_block", "reading_time", "share_bar", "related_articles", "progress_indicator"]
    },

    "media_gallery": {
      "id": "media_gallery",
      "family": "content",
      "display_name": "Media Gallery / Grid",
      "description": "A grid-based layout for displaying photos, videos, or media items.",
      "default_layout_pattern": "media_gallery_mobile",
      "default_layout_pattern_desktop": "media_gallery_desktop",
      "complexity_range": [3, 8],
      "viewport_primary": "both",
      "tov_register": "visual, minimal",
      "typical_component_count": { "min": 3, "max": 10 },
      "required_slots": ["media_grid"],
      "common_optional_slots": ["top_app_bar", "filter_bar", "upload_fab", "media_count_badge"]
    }
  }
}
```

### 2.4 Family: Transactional

```json
{
  "archetype_registry": {
    "form_single": {
      "id": "form_single",
      "family": "transactional",
      "display_name": "Single-page Form",
      "description": "A form contained in one screen. Covers contact forms, short surveys, preference settings, feedback, and simple data entry.",
      "default_layout_pattern": "form_single_mobile",
      "default_layout_pattern_desktop": "form_single_desktop",
      "complexity_range": [4, 12],
      "viewport_primary": "both",
      "tov_register": "clear, efficient, helpful",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 4, "max": 14 },
      "required_slots": ["primary_cta"],
      "common_optional_slots": ["title_block", "description_block", "text_input", "email_input", "phone_input", "select_input", "textarea_input", "checkbox_input", "radio_group", "date_picker", "form_error_message", "form_success_message"],
      "repeatable_slots": ["text_input", "select_input", "checkbox_input"],
      "never_use_components_matching": ["(?i)step.*indicator", "(?i)progress.*wizard"]
    },

    "form_multi_step": {
      "id": "form_multi_step",
      "family": "transactional",
      "display_name": "Multi-step Form / Wizard",
      "description": "A form split across multiple steps. Each screen is one step. Includes progress indication.",
      "default_layout_pattern": "form_multistep_mobile",
      "default_layout_pattern_desktop": "form_multistep_desktop",
      "complexity_range": [4, 10],
      "viewport_primary": "both",
      "tov_register": "guiding, progressive, low-anxiety",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 4, "max": 10 },
      "required_slots": ["step_indicator", "primary_cta"],
      "common_optional_slots": ["title_block", "description_block", "back_navigation", "text_input", "select_input", "radio_group"],
      "repeatable_slots": ["text_input", "select_input"],
      "never_use_components_matching": ["(?i)bottom.*nav.*tab", "(?i)sidebar"]
    },

    "checkout_cart": {
      "id": "checkout_cart",
      "family": "transactional",
      "display_name": "Cart / Checkout",
      "description": "Order review and payment screen. Shows items, total, and payment/delivery fields.",
      "default_layout_pattern": "checkout_cart_mobile",
      "default_layout_pattern_desktop": "checkout_cart_desktop",
      "complexity_range": [5, 14],
      "viewport_primary": "both",
      "tov_register": "trustworthy, clear, secure",
      "typical_component_count": { "min": 5, "max": 16 },
      "required_slots": ["cart_item_list", "order_summary", "primary_cta"],
      "common_optional_slots": ["promo_code_input", "delivery_options", "payment_method_selector", "trust_badges", "back_navigation"],
      "never_use_components_matching": ["(?i)login.*form(?!.*checkout)", "(?i)onboarding"]
    },

    "confirmation_screen": {
      "id": "confirmation_screen",
      "family": "transactional",
      "display_name": "Confirmation / Success Screen",
      "description": "Post-action confirmation. The user has completed something. Celebrate, summarize, guide next steps.",
      "default_layout_pattern": "confirmation_mobile",
      "complexity_range": [2, 5],
      "viewport_primary": "both",
      "tov_register": "celebratory, clear, forward-looking",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 3, "max": 7 },
      "required_slots": ["title_block", "primary_cta"],
      "common_optional_slots": ["illustration_placeholder", "description_block", "summary_block", "secondary_action", "share_action"],
      "never_use_components_matching": ["(?i)form.*field", "(?i)input.*field", "(?i)data.*table"]
    },

    "product_detail": {
      "id": "product_detail",
      "family": "transactional",
      "display_name": "Product Detail Page",
      "description": "E-commerce or catalog product detail. Image, description, variants, price, add-to-cart.",
      "default_layout_pattern": "product_detail_mobile",
      "default_layout_pattern_desktop": "product_detail_desktop",
      "complexity_range": [5, 14],
      "viewport_primary": "both",
      "tov_register": "persuasive, informative, trustworthy",
      "typical_component_count": { "min": 6, "max": 16 },
      "required_slots": ["product_image", "product_title", "product_price", "primary_cta"],
      "common_optional_slots": ["rating_block", "variant_selector", "quantity_input", "product_description", "trust_badges", "related_products", "sticky_add_to_cart"]
    }
  }
}
```

### 2.5 Family: Utility & System

```json
{
  "archetype_registry": {
    "settings_panel": {
      "id": "settings_panel",
      "family": "utility",
      "display_name": "Settings / Preferences",
      "description": "A screen or panel for user preferences, account settings, notification toggles, and configuration.",
      "default_layout_pattern": "settings_mobile",
      "default_layout_pattern_desktop": "settings_desktop",
      "complexity_range": [4, 12],
      "viewport_primary": "both",
      "tov_register": "neutral, clear, functional",
      "typical_component_count": { "min": 4, "max": 16 },
      "required_slots": ["settings_section_header", "settings_row"],
      "common_optional_slots": ["top_app_bar", "user_avatar_block", "toggle_row", "select_row", "destructive_action_row", "back_navigation"],
      "repeatable_slots": ["settings_row", "settings_section_header", "toggle_row"],
      "never_use_components_matching": ["(?i)login.*form", "(?i)chart", "(?i)kpi"]
    },

    "error_screen": {
      "id": "error_screen",
      "family": "utility",
      "display_name": "Error Screen",
      "description": "Full-screen error state — 404, 500, no connection, or generic failure.",
      "default_layout_pattern": "error_screen_centered",
      "complexity_range": [2, 4],
      "viewport_primary": "both",
      "tov_register": "empathetic, honest, actionable",
      "wizard_override_fields": ["tov_register"],
      "typical_component_count": { "min": 2, "max": 5 },
      "required_slots": ["illustration_placeholder", "title_block"],
      "common_optional_slots": ["description_block", "primary_cta", "secondary_action"],
      "never_use_components_matching": ["(?i)form.*field.*multiple", "(?i)data.*table", "(?i)sidebar"]
    },

    "search_results": {
      "id": "search_results",
      "family": "utility",
      "display_name": "Search Results",
      "description": "Screen showing results for a search query. Includes the search input, result count, and a list of matching items.",
      "default_layout_pattern": "search_results_mobile",
      "default_layout_pattern_desktop": "search_results_desktop",
      "complexity_range": [3, 10],
      "viewport_primary": "both",
      "tov_register": "direct, scannable",
      "typical_component_count": { "min": 4, "max": 12 },
      "required_slots": ["search_input", "list_item"],
      "common_optional_slots": ["filter_bar", "sort_control", "result_count_label", "empty_state", "search_suggestion"],
      "repeatable_slots": ["list_item"]
    },

    "profile_view": {
      "id": "profile_view",
      "family": "utility",
      "display_name": "User Profile",
      "description": "Display or edit a user's public or private profile information.",
      "default_layout_pattern": "profile_mobile",
      "default_layout_pattern_desktop": "profile_desktop",
      "complexity_range": [4, 12],
      "viewport_primary": "both",
      "tov_register": "personal, clear",
      "typical_component_count": { "min": 4, "max": 14 },
      "required_slots": ["user_avatar_block", "profile_name"],
      "common_optional_slots": ["cover_image", "bio_block", "stats_row", "action_bar", "content_tabs", "settings_row", "edit_cta"]
    },

    "notification_center": {
      "id": "notification_center",
      "family": "utility",
      "display_name": "Notifications",
      "description": "A list of the user's recent notifications. Each item is a notification entry with icon, text, and timestamp.",
      "default_layout_pattern": "notification_list_mobile",
      "complexity_range": [3, 8],
      "viewport_primary": "mobile",
      "tov_register": "informative, scannable",
      "typical_component_count": { "min": 3, "max": 10 },
      "required_slots": ["list_item"],
      "common_optional_slots": ["top_app_bar", "filter_bar", "mark_all_read_action", "empty_state"],
      "repeatable_slots": ["list_item"]
    },

    "map_view": {
      "id": "map_view",
      "family": "utility",
      "display_name": "Map / Location View",
      "description": "A screen centered on a map with location-based content overlaid (pins, cards, bottom sheet).",
      "default_layout_pattern": "map_view_mobile",
      "complexity_range": [3, 10],
      "viewport_primary": "mobile",
      "tov_register": "spatial, action-oriented",
      "typical_component_count": { "min": 3, "max": 10 },
      "required_slots": ["map_placeholder"],
      "common_optional_slots": ["search_input", "filter_chip_group", "location_card", "fab_button", "bottom_sheet"]
    },

    "chat_messaging": {
      "id": "chat_messaging",
      "family": "utility",
      "display_name": "Chat / Messaging",
      "description": "A conversation thread between two or more participants. Includes message bubbles, input bar, and optional attachments.",
      "default_layout_pattern": "chat_mobile",
      "complexity_range": [4, 10],
      "viewport_primary": "both",
      "tov_register": "conversational, immediate",
      "typical_component_count": { "min": 4, "max": 10 },
      "required_slots": ["message_bubble", "message_input_bar"],
      "common_optional_slots": ["top_app_bar", "message_timestamp", "typing_indicator", "attachment_picker", "reaction_bar"],
      "repeatable_slots": ["message_bubble", "message_timestamp"]
    }
  }
}
```

---

## SECTION 3 — `archetype_inference_rules`

These rules allow the engine to determine the correct archetype from a natural language prompt. Rules are evaluated in priority order: first `keywords_strong` match wins. If no strong match, fall back to `keywords_context` combinations.

**Processing order:**
1. Normalize prompt: lowercase, strip punctuation, expand common abbreviations
2. Check `keywords_strong` for each archetype (sorted by `inference_priority`)
3. If match: assign archetype, confidence = 1.0 × `inference_confidence_boost`
4. If no strong match: evaluate `keywords_context` combinations, assign highest-scoring archetype
5. If confidence < 0.6: trigger disambiguation flow `[CONV_UX]`
6. Apply `keywords_negative` to veto false positives

```json
{
  "archetype_inference_rules": {

    "login": {
      "inference_priority": 1,
      "keywords_strong": ["login", "sign in", "log in", "signin", "log-in", "access", "authenticate"],
      "keywords_context": [
        ["email", "password", "submit"],
        ["username", "password"],
        ["credentials", "enter"],
        ["account", "access", "screen"]
      ],
      "keywords_negative": ["register", "sign up", "create account", "new account"],
      "ambiguity_resolution": "If 'account' appears without 'password' or 'credentials', prefer register over login.",
      "disambiguation_question": "Is this screen for users who already have an account, or for new users creating one?",
      "conv_ux_hint": "Suggest: 'Sign in screen' or 'New account registration'?"
    },

    "register": {
      "inference_priority": 1,
      "keywords_strong": ["register", "sign up", "signup", "create account", "new account", "registration", "join"],
      "keywords_context": [
        ["name", "email", "password", "confirm"],
        ["first name", "last name", "email"],
        ["create", "account", "form"]
      ],
      "keywords_negative": ["login", "sign in", "existing"],
      "disambiguation_question": "Is this for creating a new account or signing into an existing one?"
    },

    "forgot_password": {
      "inference_priority": 1,
      "keywords_strong": ["forgot password", "reset password", "forgot", "reset", "recover password", "lost password"],
      "keywords_context": [
        ["email", "reset", "link"],
        ["password", "forgot"],
        ["recover", "account"]
      ],
      "keywords_negative": ["new password", "change password", "update password"]
    },

    "onboarding_step": {
      "inference_priority": 2,
      "keywords_strong": ["onboarding", "welcome screen", "intro screen", "first run", "tutorial step", "walkthrough"],
      "keywords_context": [
        ["welcome", "app", "get started"],
        ["feature", "highlight", "swipe"],
        ["skip", "next", "illustration"]
      ],
      "keywords_negative": ["login", "register", "step 2 of form"],
      "disambiguation_question": "Is this a standalone welcome/intro screen, or part of a multi-step onboarding flow?"
    },

    "home_dashboard": {
      "inference_priority": 2,
      "keywords_strong": ["dashboard", "home screen", "main screen", "overview", "home page", "home"],
      "keywords_context": [
        ["summary", "stats", "kpi"],
        ["recent", "activity", "overview"],
        ["main", "app", "after login"]
      ],
      "keywords_negative": ["login", "register", "onboarding"],
      "disambiguation_question": "Is this the main screen the user lands on after login, or a specific section of the app?",
      "ambiguity_resolution": "If prompt is only 'home', prefer home_dashboard unless DS has no navigation components."
    },

    "list_feed": {
      "inference_priority": 2,
      "keywords_strong": ["list", "feed", "inbox", "timeline", "news feed", "activity feed", "items list"],
      "keywords_context": [
        ["items", "scroll", "rows"],
        ["cards", "list", "browse"],
        ["entries", "results", "content"]
      ],
      "keywords_negative": ["detail", "single item", "product page"],
      "ambiguity_resolution": "If 'search results' appears, prefer search_results over list_feed."
    },

    "detail_view": {
      "inference_priority": 2,
      "keywords_strong": ["detail", "detail page", "item detail", "view detail", "single item", "article", "post detail"],
      "keywords_context": [
        ["back", "title", "description", "image"],
        ["expand", "full", "view"],
        ["open", "item", "screen"]
      ],
      "keywords_negative": ["list", "feed", "all items"]
    },

    "form_single": {
      "inference_priority": 2,
      "keywords_strong": ["form", "contact form", "feedback form", "survey", "questionnaire", "data entry"],
      "keywords_context": [
        ["fields", "submit", "send"],
        ["input", "fill", "form"],
        ["contact", "message", "name", "email"]
      ],
      "keywords_negative": ["multi-step", "wizard", "step 1 of", "progress"]
    },

    "form_multi_step": {
      "inference_priority": 2,
      "keywords_strong": ["multi-step form", "wizard", "step by step", "onboarding form", "multi step"],
      "keywords_context": [
        ["step", "progress", "next"],
        ["step 1", "step 2"],
        ["wizard", "form", "flow"]
      ],
      "keywords_negative": ["single form", "one page form"]
    },

    "settings_panel": {
      "inference_priority": 2,
      "keywords_strong": ["settings", "preferences", "configuration", "options", "account settings"],
      "keywords_context": [
        ["toggle", "notifications", "privacy"],
        ["theme", "language", "account"],
        ["manage", "controls", "settings"]
      ],
      "keywords_negative": ["login", "register"]
    },

    "empty_state": {
      "inference_priority": 3,
      "keywords_strong": ["empty state", "no content", "nothing here", "empty", "zero state"],
      "keywords_context": [
        ["illustration", "no items", "add first"],
        ["no results", "get started", "create first"],
        ["empty", "placeholder", "action"]
      ]
    },

    "error_screen": {
      "inference_priority": 2,
      "keywords_strong": ["error", "404", "500", "not found", "error page", "something went wrong", "offline", "no connection"],
      "keywords_context": [
        ["retry", "go back", "error"],
        ["connection", "lost", "failed"],
        ["oops", "problem", "try again"]
      ]
    },

    "confirmation_screen": {
      "inference_priority": 2,
      "keywords_strong": ["success", "confirmation", "thank you", "order confirmed", "done", "completed", "all set"],
      "keywords_context": [
        ["confirmed", "order", "next steps"],
        ["thank you", "submitted", "received"],
        ["success", "complete", "done"]
      ],
      "keywords_negative": ["error", "failed", "problem"]
    },

    "checkout_cart": {
      "inference_priority": 2,
      "keywords_strong": ["cart", "checkout", "bag", "basket", "order summary", "payment"],
      "keywords_context": [
        ["items", "total", "pay"],
        ["product", "quantity", "buy"],
        ["shipping", "delivery", "order"]
      ]
    },

    "search_results": {
      "inference_priority": 2,
      "keywords_strong": ["search results", "search screen", "search page", "results page"],
      "keywords_context": [
        ["search", "results", "query"],
        ["found", "items", "filter"],
        ["no results", "search", "empty"]
      ]
    },

    "profile_view": {
      "inference_priority": 2,
      "keywords_strong": ["profile", "user profile", "my profile", "account page", "profile page"],
      "keywords_context": [
        ["avatar", "bio", "username"],
        ["followers", "following", "posts"],
        ["edit profile", "user info"]
      ]
    },

    "notification_center": {
      "inference_priority": 2,
      "keywords_strong": ["notifications", "notification center", "alerts screen", "inbox notifications"],
      "keywords_context": [
        ["notifications", "unread", "bell"],
        ["alerts", "messages", "updates"]
      ]
    },

    "chat_messaging": {
      "inference_priority": 2,
      "keywords_strong": ["chat", "messaging", "conversation", "message thread", "direct message", "dm"],
      "keywords_context": [
        ["messages", "bubble", "send"],
        ["chat", "reply", "thread"],
        ["conversation", "user", "send"]
      ]
    },

    "product_detail": {
      "inference_priority": 2,
      "keywords_strong": ["product page", "product detail", "item page", "pdp", "product view"],
      "keywords_context": [
        ["price", "add to cart", "product"],
        ["buy", "description", "image", "size"],
        ["variant", "color", "quantity", "product"]
      ]
    },

    "article_reader": {
      "inference_priority": 3,
      "keywords_strong": ["article", "blog post", "reader", "reading view", "long-form"],
      "keywords_context": [
        ["read", "content", "text", "author"],
        ["headline", "body", "publish date"],
        ["blog", "news", "story"]
      ],
      "keywords_negative": ["list", "feed", "news feed"]
    },

    "media_gallery": {
      "inference_priority": 3,
      "keywords_strong": ["gallery", "photo grid", "media grid", "image gallery", "grid view"],
      "keywords_context": [
        ["photos", "images", "grid"],
        ["album", "gallery", "thumbnails"],
        ["media", "pictures", "upload"]
      ]
    },

    "map_view": {
      "inference_priority": 3,
      "keywords_strong": ["map", "map view", "location", "map screen"],
      "keywords_context": [
        ["map", "pins", "nearby"],
        ["location", "places", "search map"],
        ["directions", "route", "gps"]
      ]
    }
  }
}
```

### 3.1 Disambiguation Protocol `[CONV_UX]`

When inference confidence is below 0.6 or two archetypes score within 0.15 of each other, the conversational UX must ask one clarifying question. These are the recommended question templates:

```json
{
  "disambiguation_protocol": {
    "conflict_login_register": {
      "trigger": "both login and register score > 0.5",
      "question": "Is this for users signing in to an existing account, or creating a new one?",
      "options": ["Sign in (existing account)", "Create new account", "Both on the same screen"]
    },
    "conflict_list_vs_detail": {
      "trigger": "both list_feed and detail_view score > 0.5",
      "question": "Are you designing the list view (many items) or the detail view (one item opened)?",
      "options": ["List of items", "Single item detail", "Both connected (master-detail)"]
    },
    "conflict_form_single_vs_multistep": {
      "trigger": "both form_single and form_multi_step score > 0.5",
      "question": "Is this a single-screen form, or spread across multiple steps?",
      "options": ["All fields on one screen", "Split across 2+ steps with progress"]
    },
    "conflict_dashboard_vs_list": {
      "trigger": "both home_dashboard and list_feed score > 0.5",
      "question": "Is this the main home screen with mixed content, or a dedicated list view?",
      "options": ["Home screen with overview / stats", "Dedicated list or feed"]
    },
    "low_confidence_generic": {
      "trigger": "max_confidence < 0.6",
      "question": "What is the main purpose of this screen? What should the user be able to do?",
      "options": null,
      "input_type": "free_text"
    }
  }
}
```
---

## SECTION 4 — `spacing_rhythm`

Spacing is defined at three levels. Never collapse them into a single value — each level has a different visual function.

### 4.1 Base Scale

```json
{
  "spacing_rhythm": {
    "base_scale_px": [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
    "scale_alias": {
      "xs": 4,
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 24,
      "2xl": 32,
      "3xl": 48,
      "4xl": 64
    },
    "wizard_override": "If the DS Import Wizard surfaces a spacing scale from the Design System tokens, use those values as overrides for the aliases above. The scale_alias mapping is the fallback."
  }
}
```

### 4.2 Frame-Level Padding (outer container)

```json
{
  "frame_padding": {
    "mobile": {
      "horizontal": 16,
      "vertical_top": 24,
      "vertical_bottom": 32,
      "safe_area_bottom_extra": 16
    },
    "tablet": {
      "horizontal": 24,
      "vertical_top": 32,
      "vertical_bottom": 40
    },
    "desktop": {
      "horizontal": 48,
      "max_content_width": 1200,
      "vertical_top": 40,
      "vertical_bottom": 48
    },
    "desktop_narrow_panel": {
      "horizontal": 32,
      "max_content_width": 480,
      "vertical_top": 40,
      "vertical_bottom": 48
    }
  }
}
```

### 4.3 Segment-Level Gaps (between logical blocks in a pattern)

These are the gaps between the major structural blocks within a screen. The key format is `from_segment__to_segment`.

```json
{
  "segment_gaps": {

    "auth_family": {
      "brand_logo__title_block": 32,
      "title_block__description_block": 8,
      "description_block__form_area": 24,
      "form_area__primary_cta": 24,
      "primary_cta__secondary_action": 16,
      "secondary_action__social_auth": 24,
      "social_auth__terms_block": 16,
      "step_indicator__title_block": 24,
      "illustration__title_block": 32,
      "title_block__step_indicator": 12
    },

    "dashboard_family": {
      "top_app_bar__greeting_block": 24,
      "greeting_block__kpi_section": 24,
      "kpi_section__section_header": 32,
      "section_header__list_items": 12,
      "list_items__section_header_next": 32,
      "section_header__quick_actions": 16,
      "quick_actions__activity_feed": 32
    },

    "form_family": {
      "title_block__description_block": 8,
      "description_block__first_field": 24,
      "field__field": 12,
      "field_group__field_group": 24,
      "last_field__helper_text": 8,
      "helper_text__primary_cta": 24,
      "last_field__primary_cta": 32,
      "primary_cta__secondary_action": 12,
      "step_indicator__title_block": 24,
      "title_block__first_field": 20
    },

    "list_family": {
      "top_app_bar__search_input": 12,
      "search_input__filter_bar": 8,
      "filter_bar__list_items": 16,
      "top_app_bar__filter_bar": 12,
      "section_header__list_items": 8,
      "list_item__list_item": 0,
      "list_group__list_group": 24
    },

    "detail_family": {
      "hero_image__title_block": 20,
      "title_block__metadata_block": 8,
      "metadata_block__description": 16,
      "description__action_bar": 24,
      "action_bar__related_items": 40,
      "title_block__description": 12
    },

    "settings_family": {
      "top_app_bar__profile_block": 24,
      "profile_block__section_header": 32,
      "section_header__settings_rows": 8,
      "settings_group__settings_group": 32,
      "settings_row__settings_row": 0
    },

    "empty_error_family": {
      "illustration__title_block": 24,
      "title_block__description_block": 8,
      "description_block__primary_cta": 32,
      "primary_cta__secondary_action": 12
    },

    "transactional_family": {
      "cart_item__cart_item": 0,
      "cart_list__divider": 16,
      "divider__order_summary": 16,
      "order_summary__primary_cta": 24,
      "promo_code__order_summary": 12
    }
  }
}
```

### 4.4 Intra-Component Gaps (inside composed components)

These are internal spacing conventions within composed components. They guide the `component_property_playbook` and fallback layout logic.

```json
{
  "intra_component_gaps": {
    "input_field": {
      "label__input": 6,
      "input__helper_text": 4,
      "input__error_message": 4,
      "icon_leading__text": 8,
      "icon_trailing_clearance": 12
    },
    "button": {
      "icon__label": 8,
      "internal_horizontal_padding": 16,
      "internal_vertical_padding": 12
    },
    "list_item": {
      "leading_icon__text": 12,
      "text__trailing_icon": 12,
      "title__subtitle": 2,
      "item_vertical_padding": 12
    },
    "card": {
      "image__content": 12,
      "content_internal_padding": 16,
      "title__body": 8,
      "body__cta": 12
    },
    "settings_row": {
      "label__secondary_label": 2,
      "leading_icon__label": 12,
      "content__control": 8,
      "row_vertical_padding": 14
    },
    "section_header": {
      "title__action_link": 8,
      "vertical_padding": 8
    }
  }
}
```

### 4.5 Section Break Rules

A section break is visually stronger than a standard segment gap. Use it when transitioning between functionally distinct groups of content.

```json
{
  "section_break_rules": {
    "when_to_use_divider": "Use a visual divider (line or increased spacing) when transitioning between: (1) form fields and order summary, (2) KPI block and activity list, (3) user profile header and content tabs, (4) navigation header and page content.",
    "divider_spacing_above": 24,
    "divider_spacing_below": 24,
    "no_divider_needed": "Between two form fields of the same group, between two list items, between two KPI cards in the same row.",
    "spacing_as_divider_threshold": 40
  }
}
```

---

## SECTION 5 — `viewport_rules`

### 5.1 Frame Size Defaults

```json
{
  "viewport_rules": {
    "frame_defaults": {
      "mobile_ios": { "width": 390, "height": 844, "label": "iPhone 14 / 15" },
      "mobile_android": { "width": 360, "height": 800, "label": "Android Standard" },
      "mobile_small": { "width": 375, "height": 667, "label": "iPhone SE" },
      "tablet_portrait": { "width": 768, "height": 1024, "label": "iPad Portrait" },
      "tablet_landscape": { "width": 1024, "height": 768, "label": "iPad Landscape" },
      "desktop_standard": { "width": 1440, "height": 900, "label": "Desktop" },
      "desktop_wide": { "width": 1920, "height": 1080, "label": "Desktop Wide" },
      "desktop_narrow": { "width": 1280, "height": 800, "label": "Desktop Compact" }
    },
    "default_if_unspecified": "mobile_ios"
  }
}
```

### 5.2 Structural Differences by Viewport

For each archetype family, these rules define what changes structurally between mobile and desktop.

```json
{
  "viewport_structural_rules": {

    "auth_family": {
      "mobile": {
        "layout": "single column, full width",
        "brand_logo_position": "top center",
        "form_width": "full frame minus horizontal padding",
        "primary_cta_width": "full width"
      },
      "desktop": {
        "layout": "centered card, max-width 440px",
        "brand_logo_position": "above card, center or left",
        "form_width": "card width",
        "primary_cta_width": "full card width",
        "add_background": true,
        "background_treatment": "split panel or branded illustration on left side"
      }
    },

    "navigation_family": {
      "mobile": {
        "primary_nav": "bottom_nav_bar",
        "secondary_nav": "top_app_bar with back arrow",
        "sidebar": false,
        "breadcrumb": false
      },
      "desktop": {
        "primary_nav": "sidebar_nav (left, persistent)",
        "secondary_nav": "top_app_bar with breadcrumb",
        "sidebar": true,
        "breadcrumb": true,
        "bottom_nav_bar": false
      }
    },

    "content_family": {
      "mobile": {
        "columns": 1,
        "hero_aspect_ratio": "16:9 or full bleed",
        "list_item_layout": "full width, horizontal",
        "media_grid_columns": 2
      },
      "desktop": {
        "columns": "2 or 3 depending on content density",
        "hero_aspect_ratio": "21:9 or constrained",
        "list_item_layout": "can be card grid or table",
        "media_grid_columns": "3 or 4"
      }
    },

    "form_family": {
      "mobile": {
        "field_width": "full width",
        "label_position": "above field",
        "cta_position": "bottom of form, full width",
        "step_indicator_style": "dots or compact bar"
      },
      "desktop": {
        "field_width": "full or side-by-side (2 columns for related fields)",
        "label_position": "above field",
        "cta_position": "bottom right of form",
        "cta_width": "auto (not full width)",
        "step_indicator_style": "horizontal steps with labels"
      }
    },

    "settings_family": {
      "mobile": {
        "layout": "full-width list rows",
        "section_dividers": "visible"
      },
      "desktop": {
        "layout": "sidebar for categories + content panel on right",
        "max_content_width": 720,
        "section_dividers": "spacing only"
      }
    }
  }
}
```

---

## SECTION 6 — `layout_patterns`

Each pattern defines the ordered structure of a screen archetype. Segments are the logical building blocks. The engine assembles them in order, applying spacing rules from Section 4.

**Segment fields:**
- `slot` — references a slot definition from Section 7
- `optional` — can be omitted if DS has no matching component
- `repeatable` — can appear multiple times (e.g. list items)
- `max_instances` — cap on repetitions if `repeatable: true`
- `condition` — when this slot should appear (references archetype or prompt signals)

---

### Pattern: `auth_login_mobile`

```json
{
  "id": "auth_login_mobile",
  "archetypes": ["login"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "brand_logo", "optional": true, "condition": "DS has logo component or brand mark" },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "form_error_message", "optional": true, "condition": "prompt mentions error state" },
    { "slot": "email_input", "optional": false },
    { "slot": "password_input", "optional": false },
    { "slot": "forgot_password_link", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "divider_with_label", "optional": true, "condition": "social_auth is present" },
    { "slot": "social_auth", "optional": true, "condition": "prompt mentions social login or DS has social button" },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.auth_family",
  "critical_slots": ["email_input", "password_input", "primary_cta"],
  "anti_patterns": [
    "Do not use step/progress indicator components for form fields",
    "Do not use card wrappers around individual input fields",
    "Do not place two primary CTA buttons on the same screen",
    "Do not use tab bar or bottom navigation on auth screens",
    "Do not add data tables, lists or feed components to this layout"
  ],
  "typical_component_count": { "min": 4, "max": 8 }
}
```

### Pattern: `auth_login_desktop`

```json
{
  "id": "auth_login_desktop",
  "archetypes": ["login"],
  "viewport": "desktop",
  "frame_size": "desktop_standard",
  "layout_direction": "HORIZONTAL",
  "layout_note": "Left panel: brand/illustration. Right panel: centered form card.",
  "frame_padding_ref": "frame_padding.desktop",
  "segments": [
    { "slot": "brand_panel", "optional": true, "layout_weight": 0.5 },
    { "slot": "form_card_wrapper", "optional": false, "layout_weight": 0.5,
      "inner_segments": [
        { "slot": "brand_logo", "optional": true },
        { "slot": "title_block", "optional": false },
        { "slot": "description_block", "optional": true },
        { "slot": "email_input", "optional": false },
        { "slot": "password_input", "optional": false },
        { "slot": "forgot_password_link", "optional": true },
        { "slot": "primary_cta", "optional": false },
        { "slot": "secondary_action", "optional": true }
      ]
    }
  ],
  "spacing_ref": "segment_gaps.auth_family",
  "critical_slots": ["email_input", "password_input", "primary_cta"],
  "anti_patterns": [
    "Do not stack all form elements in a single full-width column on desktop",
    "Do not use mobile-style full-width CTA buttons in the desktop form card"
  ]
}
```

### Pattern: `auth_register_mobile`

```json
{
  "id": "auth_register_mobile",
  "archetypes": ["register"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "brand_logo", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "name_input", "optional": true, "condition": "prompt mentions name or full name" },
    { "slot": "email_input", "optional": false },
    { "slot": "password_input", "optional": false },
    { "slot": "confirm_password_input", "optional": true },
    { "slot": "phone_input", "optional": true, "condition": "prompt mentions phone or mobile" },
    { "slot": "terms_checkbox", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.auth_family",
  "critical_slots": ["email_input", "password_input", "primary_cta"],
  "anti_patterns": [
    "Do not use multi-step wizard layout unless archetype is form_multi_step",
    "Do not add data visualization or KPI blocks",
    "Do not place more than one password field unless confirm_password is explicitly requested"
  ]
}
```

### Pattern: `auth_forgot_password_mobile`

```json
{
  "id": "auth_forgot_password_mobile",
  "archetypes": ["forgot_password"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": false },
    { "slot": "email_input", "optional": false },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.auth_family",
  "critical_slots": ["email_input", "primary_cta"],
  "anti_patterns": [
    "Do not add password input fields to this screen",
    "Do not add social auth options"
  ]
}
```

### Pattern: `onboarding_step_mobile`

```json
{
  "id": "onboarding_step_mobile",
  "archetypes": ["onboarding_step"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Content is vertically centered within available space. Skip action floats top-right.",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "skip_action", "optional": true, "position": "top_right_absolute" },
    { "slot": "illustration_placeholder", "optional": true },
    { "slot": "step_indicator", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true, "condition": "not the last step" }
  ],
  "spacing_ref": "segment_gaps.auth_family",
  "critical_slots": ["title_block", "primary_cta"],
  "anti_patterns": [
    "Do not add form input fields — onboarding steps present, they do not collect data unless explicitly stated",
    "Do not use data tables or lists",
    "Do not use bottom tab navigation on onboarding screens"
  ]
}
```

### Pattern: `dashboard_mobile`

```json
{
  "id": "dashboard_mobile",
  "archetypes": ["home_dashboard"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "greeting_block", "optional": true },
    { "slot": "kpi_card", "optional": true, "repeatable": true, "max_instances": 4, "layout_hint": "horizontal scroll or 2-column grid" },
    { "slot": "section_header", "optional": true },
    { "slot": "quick_actions", "optional": true, "layout_hint": "horizontal scroll row" },
    { "slot": "section_header", "optional": true, "repeatable": true, "max_instances": 3 },
    { "slot": "list_item", "optional": true, "repeatable": true, "max_instances": 5 },
    { "slot": "bottom_nav_bar", "optional": true, "position": "bottom_fixed" }
  ],
  "spacing_ref": "segment_gaps.dashboard_family",
  "critical_slots": ["top_app_bar"],
  "anti_patterns": [
    "Do not use a full-page data table as the primary content on mobile dashboard",
    "Do not place more than 2 primary CTA buttons visible at the same time",
    "Do not omit all navigation elements — the user must be able to go somewhere"
  ]
}
```

### Pattern: `dashboard_desktop`

```json
{
  "id": "dashboard_desktop",
  "archetypes": ["home_dashboard"],
  "viewport": "desktop",
  "frame_size": "desktop_standard",
  "layout_direction": "HORIZONTAL",
  "layout_note": "Left: fixed sidebar nav. Right: main content area with header + scrollable content.",
  "segments": [
    { "slot": "sidebar_nav", "optional": false, "width_px": 240, "position": "left_fixed" },
    { "slot": "content_column", "optional": false, "layout_fill": true,
      "inner_segments": [
        { "slot": "top_app_bar", "optional": false },
        { "slot": "page_title", "optional": false },
        { "slot": "kpi_card", "optional": true, "repeatable": true, "max_instances": 4, "layout_hint": "4-column grid" },
        { "slot": "section_header", "optional": true },
        { "slot": "data_table_or_list", "optional": true },
        { "slot": "chart_placeholder", "optional": true }
      ]
    }
  ],
  "spacing_ref": "segment_gaps.dashboard_family",
  "critical_slots": ["sidebar_nav", "top_app_bar"],
  "anti_patterns": [
    "Do not use bottom navigation on desktop",
    "Do not create a single-column layout on desktop dashboard"
  ]
}
```

### Pattern: `list_feed_mobile`

```json
{
  "id": "list_feed_mobile",
  "archetypes": ["list_feed", "search_results", "notification_center"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "search_input", "optional": true },
    { "slot": "filter_bar", "optional": true, "layout_hint": "horizontal scroll chips" },
    { "slot": "result_count_label", "optional": true, "condition": "archetype is search_results" },
    { "slot": "list_section_header", "optional": true, "repeatable": true, "max_instances": 4 },
    { "slot": "list_item", "optional": false, "repeatable": true, "max_instances": 8 },
    { "slot": "empty_state", "optional": true, "condition": "prompt mentions no results or empty state" },
    { "slot": "fab_button", "optional": true, "position": "bottom_right_floating" },
    { "slot": "bottom_nav_bar", "optional": true, "position": "bottom_fixed" }
  ],
  "spacing_ref": "segment_gaps.list_family",
  "critical_slots": ["list_item"],
  "anti_patterns": [
    "Do not use form input fields in a list screen unless it is a search input",
    "Do not use step indicators or progress bars"
  ]
}
```

### Pattern: `detail_view_mobile`

```json
{
  "id": "detail_view_mobile",
  "archetypes": ["detail_view", "article_reader"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": false },
    { "slot": "hero_image", "optional": true },
    { "slot": "tag_list", "optional": true },
    { "slot": "detail_header", "optional": false },
    { "slot": "metadata_block", "optional": true },
    { "slot": "content_body", "optional": false },
    { "slot": "action_bar", "optional": true },
    { "slot": "divider", "optional": true },
    { "slot": "related_items", "optional": true },
    { "slot": "sticky_cta_bar", "optional": true, "position": "bottom_fixed", "condition": "prompt mentions buy or CTA" }
  ],
  "spacing_ref": "segment_gaps.detail_family",
  "critical_slots": ["detail_header", "content_body"],
  "anti_patterns": [
    "Do not add form fields to detail views unless explicitly editing",
    "Do not use step indicators",
    "Do not add sidebar navigation on mobile detail views"
  ]
}
```

### Pattern: `form_single_mobile`

```json
{
  "id": "form_single_mobile",
  "archetypes": ["form_single"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "form_error_message", "optional": true, "condition": "prompt mentions error or validation" },
    { "slot": "text_input", "optional": true, "repeatable": true, "max_instances": 8 },
    { "slot": "select_input", "optional": true, "repeatable": true, "max_instances": 4 },
    { "slot": "textarea_input", "optional": true },
    { "slot": "checkbox_input", "optional": true, "repeatable": true, "max_instances": 4 },
    { "slot": "radio_group", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.form_family",
  "critical_slots": ["primary_cta"],
  "anti_patterns": [
    "Do not use step indicators or progress bars — this is a single-page form",
    "Do not add navigation tabs or bottom nav bar",
    "Do not add data tables or KPI cards"
  ]
}
```

### Pattern: `form_multistep_mobile`

```json
{
  "id": "form_multistep_mobile",
  "archetypes": ["form_multi_step"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": true },
    { "slot": "step_indicator", "optional": false },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "text_input", "optional": true, "repeatable": true, "max_instances": 4 },
    { "slot": "select_input", "optional": true, "repeatable": true, "max_instances": 2 },
    { "slot": "radio_group", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.form_family",
  "critical_slots": ["step_indicator", "primary_cta"],
  "anti_patterns": [
    "Do not put more than 4 input fields on a single step — if needed, split into more steps",
    "Do not use tab bar navigation for form steps",
    "Do not omit the step indicator — users need to know where they are in the flow"
  ]
}
```

### Pattern: `settings_mobile`

```json
{
  "id": "settings_mobile",
  "archetypes": ["settings_panel"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "user_avatar_block", "optional": true },
    { "slot": "settings_section_header", "optional": false, "repeatable": true, "max_instances": 8 },
    { "slot": "settings_row", "optional": false, "repeatable": true, "max_instances": 24 },
    { "slot": "toggle_row", "optional": true, "repeatable": true, "max_instances": 8 },
    { "slot": "destructive_action_row", "optional": true, "position": "end_of_list" }
  ],
  "spacing_ref": "segment_gaps.settings_family",
  "critical_slots": ["settings_row"],
  "anti_patterns": [
    "Do not use chart or KPI components in settings",
    "Do not use card containers as settings rows — rows must be flat",
    "Destructive actions (delete account, log out) must always appear last"
  ]
}
```

### Pattern: `empty_state_centered`

```json
{
  "id": "empty_state_centered",
  "archetypes": ["empty_state", "error_screen"],
  "viewport": "both",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Content vertically and horizontally centered in available space.",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "illustration_placeholder", "optional": false },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "primary_cta", "optional": true },
    { "slot": "secondary_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.empty_error_family",
  "critical_slots": ["illustration_placeholder", "title_block"],
  "anti_patterns": [
    "Do not add form fields to empty or error states",
    "Do not add more than one primary action",
    "Do not add navigation tabs or bottom bars to a pure empty state screen"
  ]
}
```

### Pattern: `confirmation_mobile`

```json
{
  "id": "confirmation_mobile",
  "archetypes": ["confirmation_screen"],
  "viewport": "both",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Content centered, generous whitespace. This is a moment of celebration — do not crowd it.",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "success_illustration", "optional": false },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": true },
    { "slot": "summary_block", "optional": true, "condition": "e-commerce or booking confirmation" },
    { "slot": "primary_cta", "optional": false },
    { "slot": "secondary_action", "optional": true },
    { "slot": "share_action", "optional": true }
  ],
  "spacing_ref": "segment_gaps.empty_error_family",
  "critical_slots": ["title_block", "primary_cta"],
  "anti_patterns": [
    "Do not add form fields",
    "Do not add more than two CTAs",
    "Do not use the same tone as an error screen — this is success, not warning"
  ]
}
```

### Pattern: `checkout_cart_mobile`

```json
{
  "id": "checkout_cart_mobile",
  "archetypes": ["checkout_cart"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "cart_item_list", "optional": false, "repeatable": true, "max_instances": 6 },
    { "slot": "promo_code_input", "optional": true },
    { "slot": "divider", "optional": false },
    { "slot": "order_summary", "optional": false },
    { "slot": "primary_cta", "optional": false, "position": "bottom_fixed_or_end_of_scroll" },
    { "slot": "trust_badges", "optional": true }
  ],
  "spacing_ref": "segment_gaps.transactional_family",
  "critical_slots": ["cart_item_list", "order_summary", "primary_cta"],
  "anti_patterns": [
    "Do not add social auth or login form inside a cart screen",
    "Do not use tab bars for cart steps — use a multi-step pattern instead",
    "Do not bury the primary CTA — it must always be visible or sticky"
  ]
}
```

### Pattern: `profile_mobile`

```json
{
  "id": "profile_mobile",
  "archetypes": ["profile_view"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Header area can be full-bleed with cover image. Below: info and content sections.",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "cover_image", "optional": true },
    { "slot": "user_avatar_block", "optional": false },
    { "slot": "profile_name", "optional": false },
    { "slot": "bio_block", "optional": true },
    { "slot": "stats_row", "optional": true },
    { "slot": "action_bar", "optional": true },
    { "slot": "content_tabs", "optional": true },
    { "slot": "list_item", "optional": true, "repeatable": true, "max_instances": 5, "condition": "tab content present" },
    { "slot": "bottom_nav_bar", "optional": true, "position": "bottom_fixed" }
  ],
  "spacing_ref": "segment_gaps.detail_family",
  "critical_slots": ["user_avatar_block", "profile_name"],
  "anti_patterns": [
    "Do not place form fields in the profile header",
    "Do not use step indicators on profile screens"
  ]
}
```

### Pattern: `shell_bottom_nav_mobile`

```json
{
  "id": "shell_bottom_nav_mobile",
  "archetypes": ["bottom_nav_shell"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "This pattern defines the app shell. The content_area represents the active tab content and should be filled with a secondary pattern.",
  "segments": [
    { "slot": "top_app_bar", "optional": true },
    { "slot": "content_area", "optional": false, "layout_fill": true, "note": "Fill with archetype-specific pattern" },
    { "slot": "bottom_nav_bar", "optional": false, "position": "bottom_fixed" }
  ],
  "critical_slots": ["content_area", "bottom_nav_bar"],
  "anti_patterns": [
    "Do not combine bottom nav shell with sidebar shell",
    "Bottom nav must always have 3-5 items — not 2, not 6+"
  ]
}
```

### Pattern: `chat_mobile`

```json
{
  "id": "chat_mobile",
  "archetypes": ["chat_messaging"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Messages fill available space. Input bar is pinned to bottom, above keyboard.",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "message_bubble", "optional": false, "repeatable": true, "max_instances": 10, "layout_fill": true },
    { "slot": "message_timestamp", "optional": true, "repeatable": true, "max_instances": 5 },
    { "slot": "typing_indicator", "optional": true },
    { "slot": "message_input_bar", "optional": false, "position": "bottom_fixed" }
  ],
  "critical_slots": ["message_bubble", "message_input_bar"],
  "anti_patterns": [
    "Do not add form fields or data tables to chat screens",
    "Do not use step indicators or progress bars"
  ]
}
```

### Pattern: `map_view_mobile`

```json
{
  "id": "map_view_mobile",
  "archetypes": ["map_view"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Map fills most of the frame. UI chrome overlays the map. Bottom sheet slides up with location details.",
  "segments": [
    { "slot": "map_placeholder", "optional": false, "layout_fill": true },
    { "slot": "search_input", "optional": true, "position": "top_overlay" },
    { "slot": "filter_chip_group", "optional": true, "position": "below_search_overlay" },
    { "slot": "fab_button", "optional": true, "position": "bottom_right_floating" },
    { "slot": "bottom_sheet", "optional": true, "position": "bottom_overlay" }
  ],
  "critical_slots": ["map_placeholder"],
  "anti_patterns": [
    "Do not use a standard list layout for map view — the map is the primary element",
    "Do not add form fields or auth components"
  ]
}
```

### Pattern: `product_detail_mobile`

```json
{
  "id": "product_detail_mobile",
  "archetypes": ["product_detail"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": false },
    { "slot": "product_image", "optional": false, "layout_hint": "full bleed or 16:9" },
    { "slot": "product_title", "optional": false },
    { "slot": "product_price", "optional": false },
    { "slot": "rating_block", "optional": true },
    { "slot": "variant_selector", "optional": true },
    { "slot": "quantity_input", "optional": true },
    { "slot": "product_description", "optional": true },
    { "slot": "trust_badges", "optional": true },
    { "slot": "related_products", "optional": true },
    { "slot": "sticky_cta_bar", "optional": false, "position": "bottom_fixed" }
  ],
  "critical_slots": ["product_image", "product_title", "product_price", "sticky_cta_bar"],
  "anti_patterns": [
    "Do not hide the add-to-cart CTA in the scrollable content",
    "Do not use form wizard steps for product detail",
    "Do not add auth forms to product detail screens"
  ]
}
```

### Pattern: `media_gallery_mobile`

```json
{
  "id": "media_gallery_mobile",
  "archetypes": ["media_gallery"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "top_app_bar", "optional": false },
    { "slot": "filter_bar", "optional": true },
    { "slot": "media_grid", "optional": false, "layout_hint": "2-column grid" },
    { "slot": "upload_fab", "optional": true, "position": "bottom_right_floating" }
  ],
  "critical_slots": ["media_grid"],
  "anti_patterns": [
    "Do not use a single-column list for media gallery — grid is the expected pattern",
    "Do not add form fields"
  ]
}
```

### Pattern: `article_reader_mobile`

```json
{
  "id": "article_reader_mobile",
  "archetypes": ["article_reader"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "back_navigation", "optional": false },
    { "slot": "hero_image", "optional": true },
    { "slot": "article_header", "optional": false },
    { "slot": "author_block", "optional": true },
    { "slot": "article_body", "optional": false },
    { "slot": "share_bar", "optional": true },
    { "slot": "related_articles", "optional": true }
  ],
  "critical_slots": ["article_header", "article_body"],
  "anti_patterns": [
    "Do not add form fields or interactive inputs in the reading view",
    "Do not add bottom nav tabs — reader is a focused mode",
    "Do not use KPI cards or data tables in article view"
  ]
}
```

### Pattern: `auth_pin_mobile`

```json
{
  "id": "auth_pin_mobile",
  "archetypes": ["pin_biometric"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "layout_note": "Minimal layout. Centered content. PIN dots + keypad are the primary elements.",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "brand_logo", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "pin_input", "optional": false },
    { "slot": "biometric_trigger", "optional": true },
    { "slot": "cancel_action", "optional": true }
  ],
  "critical_slots": ["title_block", "pin_input"],
  "anti_patterns": [
    "Do not add standard text inputs",
    "Do not add navigation or tab bar"
  ]
}
```

### Pattern: `auth_verification_mobile`

```json
{
  "id": "auth_verification_mobile",
  "archetypes": ["email_verification"],
  "viewport": "mobile",
  "frame_size": "mobile_ios",
  "layout_direction": "VERTICAL",
  "frame_padding_ref": "frame_padding.mobile",
  "segments": [
    { "slot": "illustration_placeholder", "optional": true },
    { "slot": "title_block", "optional": false },
    { "slot": "description_block", "optional": false },
    { "slot": "otp_input", "optional": true },
    { "slot": "primary_cta", "optional": false },
    { "slot": "resend_action", "optional": true }
  ],
  "critical_slots": ["title_block", "description_block", "primary_cta"],
  "anti_patterns": [
    "Do not use standard password input for OTP",
    "Do not add social auth or register form"
  ]
}
```
---

## SECTION 7 — `slot_definitions`

Each slot is a semantic placeholder. The engine resolves a slot to a real DS component using the `name_regex_hints` and `page_name_hints`. If no match is found, the `fallback_strategy` defines what to do.

```json
{
  "slot_definitions": {

    "brand_logo": {
      "intent": "Brand mark or logo of the product. Usually appears at the top of auth screens.",
      "page_name_hints": ["brand", "logo", "identity", "mark"],
      "name_regex_hints": ["(?i)logo", "(?i)brand.*mark", "(?i)app.*icon"],
      "forbidden_name_regex": [],
      "fallback_strategy": "skip — do not create a placeholder rectangle",
      "singleton": true
    },

    "title_block": {
      "intent": "The main heading of the screen. A single text node with the screen's primary message.",
      "page_name_hints": ["typography", "text", "title", "heading"],
      "name_regex_hints": ["(?i)heading", "(?i)title", "(?i)h1", "(?i)display.*text", "(?i)screen.*title"],
      "forbidden_name_regex": ["(?i)subtitle(?!.*title)", "(?i)caption", "(?i)label"],
      "fallback_strategy": "create a text node using the largest available text style from the DS",
      "singleton": true
    },

    "description_block": {
      "intent": "Supporting body text below the title. Explains context or gives instruction.",
      "page_name_hints": ["typography", "text", "body", "description"],
      "name_regex_hints": ["(?i)body.*text", "(?i)description", "(?i)subtitle", "(?i)paragraph", "(?i)supporting.*text"],
      "forbidden_name_regex": ["(?i)heading", "(?i)title(?!.*description)"],
      "fallback_strategy": "create a text node using the body text style from the DS",
      "singleton": false
    },

    "email_input": {
      "intent": "A text input field specifically for email address. Must have email-appropriate keyboard type.",
      "page_name_hints": ["input", "form", "field", "text field"],
      "name_regex_hints": ["(?i)input", "(?i)text.*field", "(?i)field", "(?i)form.*control"],
      "forbidden_name_regex": ["(?i)step", "(?i)card(?!.*input)", "(?i)dropdown", "(?i)select"],
      "preferred_variant_hints": { "Type": "Email", "State": "Default", "Label": "shown" },
      "fallback_strategy": "use generic text input with label 'Email'",
      "singleton": true
    },

    "password_input": {
      "intent": "A text input with masked/hidden text for password entry. Must have show/hide toggle if DS supports it.",
      "page_name_hints": ["input", "form", "field"],
      "name_regex_hints": ["(?i)input", "(?i)text.*field", "(?i)field", "(?i)password"],
      "preferred_variant_hints": { "Type": "Password", "State": "Default" },
      "fallback_strategy": "use generic text input with label 'Password'",
      "singleton": true
    },

    "confirm_password_input": {
      "intent": "A second password field for confirmation during registration.",
      "page_name_hints": ["input", "form", "field"],
      "name_regex_hints": ["(?i)input", "(?i)text.*field"],
      "preferred_variant_hints": { "Type": "Password", "State": "Default" },
      "fallback_strategy": "use generic text input with label 'Confirm Password'",
      "singleton": true
    },

    "name_input": {
      "intent": "A text input for first name, last name, or full name.",
      "page_name_hints": ["input", "form", "field"],
      "name_regex_hints": ["(?i)input", "(?i)text.*field"],
      "preferred_variant_hints": { "Type": "Text", "State": "Default" },
      "fallback_strategy": "use generic text input with label 'Full Name'",
      "singleton": false
    },

    "phone_input": {
      "intent": "A text input for phone number, often with country code selector.",
      "page_name_hints": ["input", "form", "field", "phone"],
      "name_regex_hints": ["(?i)phone", "(?i)tel.*input", "(?i)mobile.*field", "(?i)input"],
      "preferred_variant_hints": { "Type": "Phone", "State": "Default" },
      "fallback_strategy": "use generic text input with label 'Phone Number'",
      "singleton": true
    },

    "otp_input": {
      "intent": "A series of individual digit input boxes for one-time password or verification code.",
      "page_name_hints": ["input", "otp", "code", "verification"],
      "name_regex_hints": ["(?i)otp", "(?i)code.*input", "(?i)verification.*input", "(?i)pin.*input"],
      "fallback_strategy": "use generic text input with label 'Verification Code'",
      "singleton": true
    },

    "pin_input": {
      "intent": "PIN entry interface, typically dots + numeric keypad.",
      "page_name_hints": ["pin", "passcode", "security"],
      "name_regex_hints": ["(?i)pin", "(?i)passcode", "(?i)dot.*input"],
      "fallback_strategy": "skip — note in generation log that PIN component was not found",
      "singleton": true
    },

    "primary_cta": {
      "intent": "The single most important action button on the screen. Full width on mobile, auto-width on desktop.",
      "page_name_hints": ["button", "action", "cta", "primary"],
      "name_regex_hints": ["(?i)button", "(?i)cta", "(?i)btn"],
      "preferred_variant_hints": { "Type": "Primary", "State": "Default", "Size": "Large" },
      "forbidden_name_regex": ["(?i)ghost", "(?i)link.*button", "(?i)icon.*only", "(?i)fab(?!.*primary)"],
      "fallback_strategy": "create a rectangle with the primary brand color and a centered text node",
      "singleton": true,
      "critical": true
    },

    "secondary_action": {
      "intent": "A less prominent action — ghost button, text link, or secondary button. Used for alternative paths (e.g. 'Create account', 'Skip').",
      "page_name_hints": ["button", "action", "link", "secondary"],
      "name_regex_hints": ["(?i)button", "(?i)ghost.*button", "(?i)text.*button", "(?i)link.*button", "(?i)secondary"],
      "preferred_variant_hints": { "Type": "Secondary", "State": "Default" },
      "forbidden_name_regex": ["(?i)primary(?!.*secondary)"],
      "fallback_strategy": "create a text node styled as a link",
      "singleton": false
    },

    "social_auth": {
      "intent": "Social login options: Google, Apple, Facebook, etc. Can be a button group or individual buttons.",
      "page_name_hints": ["social", "auth", "oauth", "button"],
      "name_regex_hints": ["(?i)google", "(?i)apple.*sign", "(?i)social.*button", "(?i)oauth"],
      "fallback_strategy": "skip — do not create placeholder social buttons",
      "singleton": false
    },

    "divider_with_label": {
      "intent": "A horizontal rule with centered text — typically 'OR' — used between two auth methods.",
      "page_name_hints": ["divider", "separator"],
      "name_regex_hints": ["(?i)divider.*or", "(?i)or.*divider", "(?i)separator.*label"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "divider": {
      "intent": "A plain horizontal separator between sections with no label.",
      "page_name_hints": ["divider", "separator", "rule"],
      "name_regex_hints": ["(?i)divider", "(?i)separator", "(?i)horizontal.*rule"],
      "fallback_strategy": "create a 1px line using the border color token if available",
      "singleton": false
    },

    "step_indicator": {
      "intent": "Progress indicator showing the user's current step in a multi-step flow. Dots, bars, or numbered steps.",
      "page_name_hints": ["stepper", "progress", "indicator", "steps"],
      "name_regex_hints": ["(?i)step.*indicator", "(?i)progress.*dots", "(?i)stepper", "(?i)step.*bar"],
      "forbidden_name_regex": ["(?i)progress.*bar(?!.*step)"],
      "fallback_strategy": "skip — note in generation log",
      "singleton": true
    },

    "illustration_placeholder": {
      "intent": "A visual asset — illustration, icon, or image — that supports the screen's emotional tone. Used in empty states, onboarding, confirmation, and errors.",
      "page_name_hints": ["illustration", "asset", "image", "icon"],
      "name_regex_hints": ["(?i)illustration", "(?i)empty.*state.*image", "(?i)hero.*image(?!.*product)", "(?i)spot.*illustration"],
      "fallback_strategy": "create a placeholder rectangle 240x240px with a dashed border and label 'Illustration'",
      "singleton": true
    },

    "success_illustration": {
      "intent": "A celebratory visual for confirmation/success screens — checkmark, confetti, or success icon.",
      "page_name_hints": ["illustration", "success", "confirmation"],
      "name_regex_hints": ["(?i)success.*icon", "(?i)check.*illustration", "(?i)confirmation.*image", "(?i)done.*illustration"],
      "fallback_strategy": "use illustration_placeholder with label 'Success'",
      "singleton": true
    },

    "top_app_bar": {
      "intent": "The persistent top bar containing title, back/menu icon, and optional actions.",
      "page_name_hints": ["app bar", "header", "navigation", "top bar"],
      "name_regex_hints": ["(?i)app.*bar", "(?i)top.*bar", "(?i)toolbar", "(?i)nav.*bar(?!.*bottom)", "(?i)header(?!.*card)"],
      "preferred_variant_hints": { "Type": "Default", "Size": "Standard" },
      "forbidden_name_regex": ["(?i)bottom.*nav", "(?i)tab.*bar"],
      "fallback_strategy": "create a frame with height 56px, background surface color, containing a title text node",
      "singleton": true
    },

    "bottom_nav_bar": {
      "intent": "Persistent bottom navigation with 3-5 icon+label tab items.",
      "page_name_hints": ["bottom navigation", "tab bar", "nav bar"],
      "name_regex_hints": ["(?i)bottom.*nav", "(?i)tab.*bar", "(?i)nav.*bar.*bottom"],
      "forbidden_name_regex": ["(?i)top.*bar", "(?i)app.*bar(?!.*bottom)"],
      "fallback_strategy": "skip — note in generation log if no bottom nav component found",
      "singleton": true
    },

    "sidebar_nav": {
      "intent": "Persistent left-side navigation panel for desktop layouts.",
      "page_name_hints": ["sidebar", "navigation", "menu"],
      "name_regex_hints": ["(?i)sidebar", "(?i)side.*nav", "(?i)navigation.*panel", "(?i)drawer"],
      "forbidden_name_regex": ["(?i)bottom.*nav", "(?i)tab.*bar"],
      "fallback_strategy": "skip and fall back to top_app_bar only if no sidebar component found",
      "singleton": true
    },

    "back_navigation": {
      "intent": "Back button or arrow to navigate to the previous screen.",
      "page_name_hints": ["navigation", "action", "icon"],
      "name_regex_hints": ["(?i)back.*button", "(?i)back.*arrow", "(?i)nav.*back", "(?i)close.*button"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "list_item": {
      "intent": "A single repeatable row or card representing one item in a list.",
      "page_name_hints": ["list", "item", "row", "card", "cell"],
      "name_regex_hints": ["(?i)list.*item", "(?i)row.*item", "(?i)cell", "(?i)list.*row", "(?i)item.*card"],
      "forbidden_name_regex": ["(?i)header(?!.*item)", "(?i)section.*header"],
      "fallback_strategy": "create a frame 56px tall with leading avatar, title text, and trailing icon",
      "singleton": false,
      "repeatable": true
    },

    "list_section_header": {
      "intent": "A label that groups list items into named sections.",
      "page_name_hints": ["list", "header", "label", "section"],
      "name_regex_hints": ["(?i)section.*header", "(?i)list.*header", "(?i)group.*label"],
      "fallback_strategy": "create a text node using the label style from the DS",
      "singleton": false,
      "repeatable": true
    },

    "settings_section_header": {
      "intent": "A section divider header for grouped settings rows.",
      "page_name_hints": ["settings", "section", "header", "label"],
      "name_regex_hints": ["(?i)section.*header", "(?i)settings.*header", "(?i)group.*header"],
      "fallback_strategy": "create a text node using the caption or overline style",
      "singleton": false,
      "repeatable": true
    },

    "settings_row": {
      "intent": "A single settings item row with a label, optional secondary label, and trailing control or chevron.",
      "page_name_hints": ["settings", "row", "list item", "cell"],
      "name_regex_hints": ["(?i)settings.*row", "(?i)list.*item", "(?i)menu.*item", "(?i)cell.*nav"],
      "preferred_variant_hints": { "Type": "Navigation", "Trailing": "Chevron" },
      "fallback_strategy": "use list_item with trailing chevron variant",
      "singleton": false,
      "repeatable": true
    },

    "toggle_row": {
      "intent": "A settings row with a toggle switch as the trailing control.",
      "page_name_hints": ["settings", "toggle", "switch", "row"],
      "name_regex_hints": ["(?i)toggle.*row", "(?i)switch.*row", "(?i)list.*item.*toggle", "(?i)settings.*toggle"],
      "preferred_variant_hints": { "Trailing": "Toggle", "Toggle_State": "Off" },
      "fallback_strategy": "use settings_row with a separate toggle component placed as trailing",
      "singleton": false,
      "repeatable": true
    },

    "destructive_action_row": {
      "intent": "A settings row for dangerous or irreversible actions like 'Delete account' or 'Log out'. Styled in error/danger color.",
      "page_name_hints": ["settings", "row", "button", "destructive"],
      "name_regex_hints": ["(?i)destructive", "(?i)danger.*row", "(?i)delete.*row", "(?i)logout.*row"],
      "preferred_variant_hints": { "Type": "Destructive" },
      "fallback_strategy": "use settings_row with text styled in the error color token",
      "singleton": false
    },

    "kpi_card": {
      "intent": "A compact card showing a key metric — a number, label, and optional trend indicator.",
      "page_name_hints": ["card", "stats", "kpi", "metric", "dashboard"],
      "name_regex_hints": ["(?i)kpi", "(?i)metric.*card", "(?i)stat.*card", "(?i)number.*card"],
      "forbidden_name_regex": ["(?i)product.*card", "(?i)list.*card"],
      "fallback_strategy": "create a card frame with a large number text and a label text below it",
      "singleton": false,
      "repeatable": true
    },

    "greeting_block": {
      "intent": "A personalized welcome message — e.g. 'Good morning, Alex'. Can include avatar.",
      "page_name_hints": ["greeting", "header", "welcome", "dashboard"],
      "name_regex_hints": ["(?i)greeting", "(?i)welcome.*block", "(?i)user.*header"],
      "fallback_strategy": "create a text node with 'Good morning' copy and a secondary subtitle",
      "singleton": true
    },

    "quick_actions": {
      "intent": "A horizontal row of icon+label shortcut buttons for frequent actions on the dashboard.",
      "page_name_hints": ["action", "shortcut", "quick", "button"],
      "name_regex_hints": ["(?i)quick.*action", "(?i)shortcut.*button", "(?i)action.*chip"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "filter_bar": {
      "intent": "A horizontal scrollable row of filter chips or segmented control for narrowing list content.",
      "page_name_hints": ["filter", "chip", "tab", "control"],
      "name_regex_hints": ["(?i)filter.*bar", "(?i)chip.*group", "(?i)filter.*chip", "(?i)segmented"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "search_input": {
      "intent": "A search text field, usually with a search icon and clear button.",
      "page_name_hints": ["search", "input", "field"],
      "name_regex_hints": ["(?i)search.*bar", "(?i)search.*input", "(?i)search.*field"],
      "preferred_variant_hints": { "Type": "Search", "State": "Default" },
      "fallback_strategy": "use generic text input with search icon and label 'Search'",
      "singleton": true
    },

    "fab_button": {
      "intent": "Floating action button — a prominent circular button for the primary action of a screen.",
      "page_name_hints": ["fab", "button", "action"],
      "name_regex_hints": ["(?i)fab", "(?i)floating.*action", "(?i)round.*button"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "form_error_message": {
      "intent": "An inline error banner or alert shown when form validation fails.",
      "page_name_hints": ["alert", "error", "message", "banner"],
      "name_regex_hints": ["(?i)error.*banner", "(?i)form.*error", "(?i)alert.*error", "(?i)inline.*error"],
      "preferred_variant_hints": { "Type": "Error", "State": "Visible" },
      "fallback_strategy": "create a frame with error color background and error text",
      "singleton": true
    },

    "terms_checkbox": {
      "intent": "A checkbox with 'I agree to the Terms of Service' label.",
      "page_name_hints": ["checkbox", "form", "input"],
      "name_regex_hints": ["(?i)checkbox", "(?i)check.*input", "(?i)check.*box"],
      "preferred_variant_hints": { "State": "Unchecked" },
      "fallback_strategy": "create a checkbox frame with label text",
      "singleton": true
    },

    "skip_action": {
      "intent": "A text link or ghost button allowing the user to skip the current step.",
      "page_name_hints": ["button", "action", "link"],
      "name_regex_hints": ["(?i)skip", "(?i)text.*button", "(?i)ghost.*button"],
      "fallback_strategy": "create a text node with 'Skip' label styled as a link",
      "singleton": true
    },

    "biometric_trigger": {
      "intent": "A button or icon that initiates Face ID or fingerprint authentication.",
      "page_name_hints": ["biometric", "faceid", "fingerprint", "icon"],
      "name_regex_hints": ["(?i)biometric", "(?i)face.*id", "(?i)fingerprint", "(?i)touch.*id"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "resend_action": {
      "intent": "A text link or button to resend a verification code or email.",
      "page_name_hints": ["button", "link", "action"],
      "name_regex_hints": ["(?i)resend", "(?i)send.*again", "(?i)text.*button"],
      "fallback_strategy": "create a text node with 'Resend code' label",
      "singleton": true
    },

    "forgot_password_link": {
      "intent": "A text link to the forgot password flow, usually below the password field.",
      "page_name_hints": ["button", "link", "action"],
      "name_regex_hints": ["(?i)forgot", "(?i)text.*link", "(?i)text.*button"],
      "fallback_strategy": "create a text node with 'Forgot password?' label",
      "singleton": true
    },

    "page_title": {
      "intent": "The title of a page within the app (distinct from the app bar title when both are present).",
      "page_name_hints": ["typography", "heading", "title"],
      "name_regex_hints": ["(?i)page.*title", "(?i)screen.*title", "(?i)h1.*heading"],
      "fallback_strategy": "create a text node using Heading 1 style",
      "singleton": true
    },

    "section_header": {
      "intent": "A labeled header introducing a content section, often with an optional 'See all' link.",
      "page_name_hints": ["section", "header", "label"],
      "name_regex_hints": ["(?i)section.*header", "(?i)section.*title", "(?i)content.*header"],
      "fallback_strategy": "create a text node using Heading 2 style",
      "singleton": false,
      "repeatable": true
    },

    "user_avatar_block": {
      "intent": "User's profile picture/avatar, often with name and role below it.",
      "page_name_hints": ["avatar", "profile", "user", "header"],
      "name_regex_hints": ["(?i)avatar", "(?i)profile.*header", "(?i)user.*block", "(?i)account.*header"],
      "fallback_strategy": "create a circle placeholder with initials text",
      "singleton": true
    },

    "breadcrumb": {
      "intent": "Navigation path showing the current location within a hierarchy (desktop only).",
      "page_name_hints": ["breadcrumb", "navigation", "path"],
      "name_regex_hints": ["(?i)breadcrumb", "(?i)nav.*path"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "map_placeholder": {
      "intent": "A full-area map view placeholder.",
      "page_name_hints": ["map", "location"],
      "name_regex_hints": ["(?i)map", "(?i)location.*view"],
      "fallback_strategy": "create a full-frame rectangle with a light green fill and a map pin icon centered",
      "singleton": true
    },

    "message_bubble": {
      "intent": "A single chat message displayed as a bubble — sent or received.",
      "page_name_hints": ["chat", "message", "bubble"],
      "name_regex_hints": ["(?i)message.*bubble", "(?i)chat.*bubble", "(?i)bubble"],
      "preferred_variant_hints": { "Direction": "Received" },
      "fallback_strategy": "create a rounded rectangle with body text",
      "singleton": false,
      "repeatable": true
    },

    "message_input_bar": {
      "intent": "The compose/send bar at the bottom of a chat screen.",
      "page_name_hints": ["chat", "input", "compose"],
      "name_regex_hints": ["(?i)message.*input", "(?i)compose.*bar", "(?i)chat.*input"],
      "fallback_strategy": "create a frame with a text field and send button",
      "singleton": true
    },

    "product_image": {
      "intent": "Primary product image area — full bleed or contained with aspect ratio.",
      "page_name_hints": ["image", "product", "media"],
      "name_regex_hints": ["(?i)product.*image", "(?i)hero.*image", "(?i)item.*image"],
      "fallback_strategy": "create a full-width rectangle placeholder with aspect ratio 3:4",
      "singleton": true
    },

    "media_grid": {
      "intent": "A grid of image/video thumbnails.",
      "page_name_hints": ["grid", "gallery", "media"],
      "name_regex_hints": ["(?i)media.*grid", "(?i)photo.*grid", "(?i)gallery.*grid"],
      "fallback_strategy": "create a 2-column auto-layout grid with square placeholder cells",
      "singleton": true
    },

    "tab_bar": {
      "intent": "A horizontal tab navigation bar at the top of a content area.",
      "page_name_hints": ["tab", "navigation", "bar"],
      "name_regex_hints": ["(?i)tab.*bar", "(?i)tab.*nav", "(?i)horizontal.*tabs"],
      "forbidden_name_regex": ["(?i)bottom.*nav"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "bottom_sheet": {
      "intent": "A panel that slides up from the bottom of the screen to show detail or options.",
      "page_name_hints": ["sheet", "bottom", "panel", "drawer"],
      "name_regex_hints": ["(?i)bottom.*sheet", "(?i)action.*sheet", "(?i)drawer.*bottom"],
      "fallback_strategy": "skip",
      "singleton": true
    },

    "content_area": {
      "intent": "The main content zone of a shell pattern — filled with page-specific content.",
      "page_name_hints": [],
      "name_regex_hints": [],
      "fallback_strategy": "create an empty auto-layout frame with FILL sizing",
      "singleton": true
    }
  }
}
```

---

## SECTION 8 — `component_property_playbook`

This section tells the engine exactly how to configure component instances after placement. Properties are set via `instance.setProperties()`. The playbook uses regex to match property names (Figma often appends IDs like `#123:456`).

For each match entry, the engine applies properties in order. If a property is not found on the instance, the engine logs a skip and continues.

### 8.1 Fallback Hierarchy

For every property application attempt, the engine follows this three-level hierarchy:

**Level 1 — Direct property set:** `instance.setProperties({ matchedPropertyName: value })`
**Level 2 — Inner layer text:** If the property is TEXT type and Level 1 fails, find the inner text node matching `text_node_regex` and set `node.characters = value`
**Level 3 — Skip with log:** Log `{ slot, property_name_regex, reason: 'not_found', instance_id }` in generation telemetry

### 8.2 Playbook Entries

```json
{
  "component_property_playbook": [

    {
      "match": { "slot": "title_block" },
      "properties": [
        {
          "property_name_regex": "(?i)text|title|heading|label",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].title",
          "text_node_regex": "(?i)title|heading|label",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)show.*icon|icon.*visible",
          "type": "BOOLEAN",
          "value": false,
          "condition": "unless prompt explicitly mentions icon"
        }
      ]
    },

    {
      "match": { "slot": "description_block" },
      "properties": [
        {
          "property_name_regex": "(?i)text|body|description|subtitle",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].description",
          "text_node_regex": "(?i)body|description|subtitle",
          "fallback_level": 2
        }
      ]
    },

    {
      "match": { "slot": "primary_cta" },
      "properties": [
        {
          "property_name_regex": "(?i)label|text|button.*text|cta.*text",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].primary_cta",
          "text_node_regex": "(?i)label|text",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)type|variant|style",
          "type": "VARIANT",
          "value": "Primary",
          "condition": "always"
        },
        {
          "property_name_regex": "(?i)state",
          "type": "VARIANT",
          "value": "Default"
        },
        {
          "property_name_regex": "(?i)size",
          "type": "VARIANT",
          "value": "Large",
          "condition": "mobile viewport"
        },
        {
          "property_name_regex": "(?i)loading|is.*loading",
          "type": "BOOLEAN",
          "value": false
        },
        {
          "property_name_regex": "(?i)disabled|is.*disabled",
          "type": "BOOLEAN",
          "value": false
        },
        {
          "property_name_regex": "(?i)icon|left.*icon|right.*icon",
          "type": "BOOLEAN",
          "value": false,
          "condition": "unless prompt mentions icon"
        }
      ]
    },

    {
      "match": { "slot": "secondary_action" },
      "properties": [
        {
          "property_name_regex": "(?i)label|text",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].secondary_action",
          "text_node_regex": "(?i)label|text",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)type|variant",
          "type": "VARIANT",
          "value": "Ghost"
        }
      ]
    },

    {
      "match": { "slot": "email_input" },
      "properties": [
        {
          "property_name_regex": "(?i)label",
          "type": "TEXT",
          "value": "Email",
          "text_node_regex": "(?i)label",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)placeholder|hint",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].email_placeholder",
          "text_node_regex": "(?i)placeholder|hint",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)type|input.*type",
          "type": "VARIANT",
          "value": "Email"
        },
        {
          "property_name_regex": "(?i)state",
          "type": "VARIANT",
          "value": "Default"
        },
        {
          "property_name_regex": "(?i)error|has.*error",
          "type": "BOOLEAN",
          "value": false,
          "condition": "unless prompt mentions error state"
        },
        {
          "property_name_regex": "(?i)icon|leading.*icon",
          "type": "BOOLEAN",
          "value": false
        }
      ]
    },

    {
      "match": { "slot": "password_input" },
      "properties": [
        {
          "property_name_regex": "(?i)label",
          "type": "TEXT",
          "value": "Password",
          "text_node_regex": "(?i)label",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)placeholder|hint",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].password_placeholder",
          "text_node_regex": "(?i)placeholder|hint",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)type|input.*type",
          "type": "VARIANT",
          "value": "Password"
        },
        {
          "property_name_regex": "(?i)show.*password|eye.*icon|visibility",
          "type": "BOOLEAN",
          "value": true
        },
        {
          "property_name_regex": "(?i)state",
          "type": "VARIANT",
          "value": "Default"
        }
      ]
    },

    {
      "match": { "slot": "top_app_bar" },
      "properties": [
        {
          "property_name_regex": "(?i)title|screen.*title|bar.*title",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].screen_title",
          "text_node_regex": "(?i)title",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)show.*back|back.*button|leading.*icon",
          "type": "BOOLEAN",
          "value_from_context": "true if not the root screen, false if root screen",
          "condition": "if archetype is not home_dashboard or bottom_nav_shell"
        },
        {
          "property_name_regex": "(?i)show.*action|trailing.*icon|menu.*icon",
          "type": "BOOLEAN",
          "value": false,
          "condition": "unless prompt mentions settings icon or action"
        }
      ]
    },

    {
      "match": { "slot": "list_item" },
      "properties": [
        {
          "property_name_regex": "(?i)title|primary.*text|label",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].list_item_title",
          "text_node_regex": "(?i)title|primary",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)subtitle|secondary.*text|description",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].list_item_subtitle",
          "text_node_regex": "(?i)subtitle|secondary",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)show.*avatar|avatar.*visible|leading.*avatar",
          "type": "BOOLEAN",
          "value": true
        },
        {
          "property_name_regex": "(?i)show.*chevron|trailing.*icon|show.*arrow",
          "type": "BOOLEAN",
          "value": true
        },
        {
          "property_name_regex": "(?i)divider|show.*divider",
          "type": "BOOLEAN",
          "value": true,
          "dangerous": true,
          "danger_note": "Enabling dividers on ALL list items simultaneously can cause double-divider artifacts at section boundaries. Enable on all but the last item if DS supports it, otherwise enable on all and accept visual artifact."
        }
      ]
    },

    {
      "match": { "slot": "step_indicator" },
      "properties": [
        {
          "property_name_regex": "(?i)steps|total.*steps|step.*count",
          "type": "VARIANT",
          "value_from_context": "infer from prompt — default to 3 if not specified"
        },
        {
          "property_name_regex": "(?i)current|active.*step|step.*active",
          "type": "VARIANT",
          "value": "1"
        }
      ]
    },

    {
      "match": { "slot": "illustration_placeholder" },
      "properties": [
        {
          "property_name_regex": "(?i)type|illustration.*type|variant",
          "type": "VARIANT",
          "value_from_context": "map archetype to illustration type: empty_state→Empty, error_screen→Error, onboarding→Feature, confirmation→Success"
        }
      ]
    },

    {
      "match": { "slot": "kpi_card" },
      "properties": [
        {
          "property_name_regex": "(?i)value|metric|number",
          "type": "TEXT",
          "value": "—",
          "text_node_regex": "(?i)value|number",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)label|title|metric.*name",
          "type": "TEXT",
          "value_from": "content_defaults[archetype].kpi_label",
          "text_node_regex": "(?i)label|title",
          "fallback_level": 2
        },
        {
          "property_name_regex": "(?i)trend|direction|delta",
          "type": "VARIANT",
          "value": "Neutral"
        }
      ]
    }
  ]
}
```

---

## SECTION 9 — `content_defaults`

Content defaults provide copy when the prompt does not specify text. They are the first layer of content intelligence before Kimi's generative enrichment is invoked.

### 9.1 Kimi Enrichment Protocol

Fields marked with `[KIMI_ENRICHABLE]` below are candidates for dynamic enrichment by Kimi when DS Import Wizard supplies a `tone_of_voice` or `brand_voice` signal. When enrichment is active:

1. The engine calls Kimi with: the default copy + the DS tone_of_voice + a rewrite instruction
2. Kimi returns an enriched version respecting the DS voice
3. Enriched copy is used instead of the default

Example enrichment call:
```
System: "You are a UX copy specialist. Rewrite the provided UI copy to match this brand voice: [tone_of_voice]. Keep it under [char_limit] characters. Return only the rewritten copy, nothing else."
User: "Original copy: 'Sign in'. Brand voice: 'Playful, friendly, first-person plural'. Rewrite."
→ "Let's get you in"
```

### 9.2 Copy Defaults by Archetype

```json
{
  "content_defaults": {

    "login": {
      "screen_title": "Sign In",
      "title": "Welcome back",
      "description": "Enter your credentials to continue.",
      "email_placeholder": "your@email.com",
      "password_placeholder": "Your password",
      "primary_cta": "Sign In",
      "secondary_action": "Don't have an account? Sign up",
      "forgot_password_link": "Forgot password?",
      "social_auth_divider": "or",
      "social_cta_google": "Continue with Google",
      "social_cta_apple": "Continue with Apple",
      "kimi_enrichable_fields": ["title", "description", "primary_cta", "secondary_action"]
    },

    "register": {
      "screen_title": "Create Account",
      "title": "Get started",
      "description": "Create your account to continue.",
      "name_placeholder": "Full name",
      "email_placeholder": "your@email.com",
      "password_placeholder": "Create a password",
      "confirm_password_placeholder": "Confirm your password",
      "phone_placeholder": "+1 (555) 000-0000",
      "primary_cta": "Create Account",
      "secondary_action": "Already have an account? Sign in",
      "terms_label": "I agree to the Terms of Service and Privacy Policy",
      "kimi_enrichable_fields": ["title", "description", "primary_cta", "secondary_action"]
    },

    "forgot_password": {
      "screen_title": "Reset Password",
      "title": "Forgot your password?",
      "description": "Enter your email and we'll send you a reset link.",
      "email_placeholder": "your@email.com",
      "primary_cta": "Send Reset Link",
      "secondary_action": "Back to sign in",
      "kimi_enrichable_fields": ["title", "description", "primary_cta"]
    },

    "onboarding_step": {
      "screen_title": "Welcome",
      "step_1_title": "Everything in one place",
      "step_1_description": "Manage all your work from a single, powerful dashboard.",
      "step_2_title": "Stay in sync",
      "step_2_description": "Collaborate in real time with your team — no delays, no friction.",
      "step_3_title": "Ready when you are",
      "step_3_description": "Set up in minutes. Customize as you grow.",
      "primary_cta_middle": "Next",
      "primary_cta_last": "Get Started",
      "skip_action": "Skip",
      "kimi_enrichable_fields": ["step_1_title", "step_1_description", "step_2_title", "step_2_description", "step_3_title", "step_3_description", "primary_cta_last"]
    },

    "email_verification": {
      "screen_title": "Verify Email",
      "title": "Check your inbox",
      "description": "We sent a verification code to your email address. Enter it below.",
      "primary_cta": "Verify",
      "resend_action": "Resend code",
      "kimi_enrichable_fields": ["title", "description"]
    },

    "pin_biometric": {
      "screen_title": "Enter PIN",
      "title": "Enter your PIN",
      "biometric_trigger_label": "Use Face ID",
      "cancel_action": "Cancel",
      "kimi_enrichable_fields": ["title"]
    },

    "home_dashboard": {
      "screen_title": "Home",
      "greeting": "Good morning",
      "greeting_subtitle": "Here's what's happening today.",
      "kpi_label": "Total",
      "section_header_recent": "Recent Activity",
      "section_header_quick": "Quick Actions",
      "kimi_enrichable_fields": ["greeting_subtitle"]
    },

    "list_feed": {
      "screen_title": "All Items",
      "list_item_title": "Item Title",
      "list_item_subtitle": "Supporting detail text",
      "empty_state_title": "Nothing here yet",
      "empty_state_description": "Items you add will appear here.",
      "empty_state_cta": "Add your first item",
      "kimi_enrichable_fields": ["empty_state_title", "empty_state_description", "empty_state_cta"]
    },

    "detail_view": {
      "screen_title": "Details",
      "detail_header": "Item Title",
      "metadata": "Updated just now",
      "content_body": "Item description goes here. Add more detail to describe this item fully.",
      "primary_cta": "Take Action",
      "kimi_enrichable_fields": ["primary_cta"]
    },

    "empty_state": {
      "screen_title": "",
      "title": "Nothing to see here",
      "description": "There's no content to display right now. Check back later or take an action to get started.",
      "primary_cta": "Get Started",
      "secondary_action": "Learn More",
      "kimi_enrichable_fields": ["title", "description", "primary_cta"]
    },

    "error_screen": {
      "screen_title": "Error",
      "title_404": "Page not found",
      "description_404": "The page you're looking for doesn't exist or has been moved.",
      "title_500": "Something went wrong",
      "description_500": "We're working on fixing this. Please try again in a moment.",
      "title_offline": "No internet connection",
      "description_offline": "Check your connection and try again.",
      "primary_cta": "Try Again",
      "secondary_action": "Go Home",
      "kimi_enrichable_fields": ["title_404", "description_404", "title_500", "description_500"]
    },

    "confirmation_screen": {
      "screen_title": "Done",
      "title": "You're all set!",
      "description": "Your request has been submitted successfully.",
      "primary_cta": "Back to Home",
      "secondary_action": "View Details",
      "kimi_enrichable_fields": ["title", "description", "primary_cta"]
    },

    "form_single": {
      "screen_title": "Contact Us",
      "title": "Get in touch",
      "description": "Fill in the form below and we'll get back to you.",
      "generic_field_placeholder": "Type here...",
      "primary_cta": "Send",
      "secondary_action": "Cancel",
      "success_title": "Message sent",
      "success_description": "We'll be in touch soon.",
      "kimi_enrichable_fields": ["title", "description", "primary_cta", "success_title", "success_description"]
    },

    "form_multi_step": {
      "screen_title": "Step 1 of 3",
      "title": "Let's get to know you",
      "description": "This will only take a minute.",
      "primary_cta": "Continue",
      "secondary_action": "Back",
      "kimi_enrichable_fields": ["title", "description"]
    },

    "checkout_cart": {
      "screen_title": "Your Cart",
      "title": "Review your order",
      "cart_item_title": "Product Name",
      "cart_item_quantity": "Qty: 1",
      "order_total_label": "Total",
      "primary_cta": "Proceed to Payment",
      "promo_code_placeholder": "Promo code",
      "kimi_enrichable_fields": ["primary_cta"]
    },

    "settings_panel": {
      "screen_title": "Settings",
      "section_account": "Account",
      "section_notifications": "Notifications",
      "section_privacy": "Privacy & Security",
      "section_appearance": "Appearance",
      "section_support": "Support",
      "section_danger": "Danger Zone",
      "row_logout": "Log out",
      "row_delete_account": "Delete account",
      "kimi_enrichable_fields": []
    },

    "search_results": {
      "screen_title": "Search",
      "search_placeholder": "Search...",
      "result_count": "12 results",
      "list_item_title": "Result Title",
      "list_item_subtitle": "Matching detail",
      "empty_state_title": "No results found",
      "empty_state_description": "Try a different search term.",
      "kimi_enrichable_fields": ["empty_state_title", "empty_state_description"]
    },

    "profile_view": {
      "screen_title": "Profile",
      "profile_name": "Alex Johnson",
      "bio": "Product designer. Building things people love.",
      "edit_cta": "Edit Profile",
      "kimi_enrichable_fields": ["bio"]
    },

    "notification_center": {
      "screen_title": "Notifications",
      "empty_state_title": "You're all caught up",
      "empty_state_description": "New notifications will appear here.",
      "mark_all_read": "Mark all as read",
      "list_item_title": "Notification",
      "list_item_subtitle": "Just now",
      "kimi_enrichable_fields": ["empty_state_title", "empty_state_description"]
    },

    "product_detail": {
      "screen_title": "Product",
      "product_title": "Product Name",
      "product_price": "$99.00",
      "product_description": "Product description goes here. Describe the key features and benefits.",
      "primary_cta": "Add to Cart",
      "kimi_enrichable_fields": ["primary_cta"]
    },

    "article_reader": {
      "screen_title": "Article",
      "article_header": "Article Headline",
      "author_name": "Author Name",
      "reading_time": "5 min read",
      "article_body": "Article content goes here.",
      "kimi_enrichable_fields": []
    },

    "chat_messaging": {
      "screen_title": "Messages",
      "message_received": "Hey, how's it going?",
      "message_sent": "Doing great, thanks!",
      "input_placeholder": "Type a message...",
      "kimi_enrichable_fields": ["message_received", "message_sent"]
    },

    "map_view": {
      "screen_title": "Map",
      "search_placeholder": "Search places...",
      "location_card_title": "Nearby Location",
      "location_card_subtitle": "0.3 miles away",
      "kimi_enrichable_fields": []
    }
  }
}
```

---

## SECTION 10 — `wizard_integration`

This section defines how data collected during the DS Import Wizard enriches and overrides pack defaults at runtime. The wizard is the primary source of DS-specific intelligence. The pack is the fallback.

```json
{
  "wizard_integration": {

    "fields_collected_by_wizard": {
      "ds_name": "Name of the design system (e.g. 'Material 3', 'Acme DS v2')",
      "component_index": "Verified list of component keys, names, page sources, and variant properties",
      "variable_index": "Verified list of variable IDs, names, resolved types, and collection names",
      "text_style_index": "Verified list of text style IDs, names, fontSize, fontFamily",
      "spacing_tokens": "If the DS exposes spacing variables (e.g. spacing/sm, spacing/lg), these override spacing_rhythm.scale_alias",
      "color_tokens": "Primary, secondary, error, success, surface, and on-surface tokens by semantic role",
      "typography_scale": "Heading 1 through body/caption styles with their text style IDs",
      "tone_of_voice": "Optional free-text or structured description of the DS brand voice — triggers Kimi enrichment in content_defaults",
      "brand_voice_keywords": "Array of tone adjectives (e.g. ['playful', 'direct', 'empowering']) — used in Kimi enrichment prompt",
      "component_naming_convention": "Pattern detected from component names: e.g. 'BEM-like', 'slash-separated', 'camelCase' — informs fuzzy matcher",
      "ds_page_structure": "List of page names and their order — informs slot page_name_hints",
      "existing_patterns_found": "Layout patterns detected in the DS documentation page (if present) — can extend layout_patterns registry"
    },

    "override_rules": {

      "spacing_tokens_override": {
        "trigger": "wizard supplies spacing variable index",
        "action": "map pack spacing_rhythm.scale_alias keys to nearest DS spacing variable by value",
        "fallback": "use pack numeric values if no close match (within 2px)"
      },

      "text_style_override": {
        "trigger": "wizard supplies typography_scale",
        "action": "map title_block → H1 style ID, description_block → Body style ID, section_header → H2 style ID. Store mapping as runtime_text_style_map.",
        "effect": "executor uses textStyleId instead of raw font properties"
      },

      "tov_enrichment_trigger": {
        "trigger": "wizard supplies tone_of_voice OR brand_voice_keywords",
        "action": "for every archetype's kimi_enrichable_fields, call Kimi with enrichment prompt",
        "cache": "store enriched copy per archetype in session — do not re-call Kimi on every generation",
        "char_limits": {
          "title": 40,
          "description": 120,
          "primary_cta": 20,
          "secondary_action": 30,
          "empty_state_title": 40,
          "empty_state_description": 100
        }
      },

      "component_naming_convention_override": {
        "trigger": "wizard supplies component_naming_convention",
        "action": "adjust fuzzy matcher normalization strategy. If 'slash-separated': split on '/' and match on last segment first, then full path. If 'camelCase': tokenize on uppercase boundaries.",
        "fallback": "default normalization (lowercase, strip spaces)"
      },

      "page_hint_override": {
        "trigger": "wizard supplies ds_page_structure",
        "action": "prepend DS actual page names to each slot's page_name_hints for the matching semantic category",
        "example": "if DS has page named 'Atoms/Buttons', prepend 'Atoms/Buttons' to primary_cta.page_name_hints"
      }
    },

    "conversational_ux_wizard_signals": [
      {
        "signal": "DS has fewer than 10 components",
        "conv_ux_message": "Your design system has a small component set. Generation will focus on the components available and may use text nodes as fallback for some slots.",
        "action": "lower max_instances on all repeatable slots by 50%"
      },
      {
        "signal": "DS has no text styles defined",
        "conv_ux_message": "No text styles were found in your design system. Text will be placed using raw font values. Consider adding text styles to your DS for better results.",
        "action": "fallback_strategy for all text slots = create_text_node_raw"
      },
      {
        "signal": "DS has no spacing tokens",
        "conv_ux_message": "No spacing variables found. Using pack defaults (base scale: 4, 8, 12, 16, 24, 32).",
        "action": "use pack spacing_rhythm.base_scale_px"
      },
      {
        "signal": "tone_of_voice detected",
        "conv_ux_message": "Tone of voice detected: [tov]. Copy will be adapted to match your DS voice.",
        "action": "trigger tov_enrichment_trigger"
      }
    ]
  }
}
```

---

## SECTION 11 — `learning_loop`

This section defines how the engine collects quality signals and improves the Design Intelligence Pack over time. The goal: every generation that fails or succeeds feeds back into better future decisions.

```json
{
  "learning_loop": {

    "quality_signal_types": {
      "user_undo": {
        "description": "User triggered Ctrl+Z / Cmd+Z immediately after generation completed",
        "weight": -2.0,
        "interpretation": "Strong negative signal — the output was considered unacceptable"
      },
      "user_modified_within_60s": {
        "description": "User modified the generated frame within 60 seconds of completion",
        "weight": -0.5,
        "interpretation": "Mild negative — something needed adjustment"
      },
      "user_accepted_no_changes": {
        "description": "Generated frame was not undone or modified for 5+ minutes",
        "weight": +1.0,
        "interpretation": "Positive acceptance signal"
      },
      "user_explicit_thumbs_up": {
        "description": "User clicked thumbs up on generation in plugin UI",
        "weight": +2.0,
        "interpretation": "Strong positive"
      },
      "user_explicit_thumbs_down": {
        "description": "User clicked thumbs down on generation in plugin UI",
        "weight": -2.0,
        "interpretation": "Strong negative"
      },
      "slot_skip_rate": {
        "description": "How often a slot was skipped because no matching component was found",
        "threshold": 0.4,
        "action": "if slot skip rate > 40% across sessions for a DS, surface warning in wizard: 'Slot X is frequently unresolved for this DS. Consider adding a matching component.'"
      },
      "wrong_component_report": {
        "description": "User flagged that the wrong component was used for a slot",
        "weight": -3.0,
        "stores": ["slot_id", "used_component_key", "ds_id"],
        "action": "add used_component_key to slot's forbidden_name_regex for that DS"
      }
    },

    "telemetry_schema": {
      "session_id": "string",
      "ds_id": "string (hash of ds_name + component_count)",
      "archetype_used": "string",
      "pattern_used": "string",
      "prompt_text": "string (anonymized — no PII)",
      "components_placed": ["{ slot_id, component_key, was_found: bool }"],
      "slots_skipped": ["{ slot_id, reason }"],
      "quality_signals": ["{ type, timestamp, value }"],
      "generation_duration_ms": "number",
      "kimi_enrichment_used": "boolean"
    },

    "improvement_triggers": {
      "pattern_negative_score_threshold": {
        "description": "If a layout_pattern accumulates a net quality score below -5 across 10+ sessions",
        "action": "flag pattern for human review in admin dashboard. Add [NEEDS_REVIEW] tag.",
        "escalation": "If score < -10 across 20+ sessions, disable pattern and fall back to most similar positively-scored pattern"
      },
      "slot_resolution_improvement": {
        "description": "If a slot has skip_rate > 40% for a specific DS, suggest to the user in wizard",
        "message": "We noticed that '[slot_name]' components are often missing in your DS. Adding a '[suggested_component_type]' component would improve generation quality."
      },
      "archetype_mismatch_detection": {
        "description": "If users frequently undo and re-generate with a different archetype after an inference decision",
        "action": "lower the inference_confidence_boost for that archetype+keyword combination. Increase disambiguation frequency."
      },
      "pack_version_upgrade": {
        "description": "When improvement triggers accumulate beyond threshold, generate a diff report for the pack",
        "format": "JSON patch format — only changed values, not full pack rewrite",
        "review_required": true,
        "reviewer": "Ben & Cordiska"
      }
    },

    "admin_dashboard_metrics": [
      "Top 5 archetypes by generation count",
      "Top 5 patterns by positive quality score",
      "Bottom 5 patterns by quality score (flagged for review)",
      "Slot skip rate by slot_id and ds_id",
      "Kimi enrichment usage rate",
      "Average generation duration by archetype",
      "Wrong component report count by ds_id"
    ]
  }
}
```

---

## SECTION 12 — `correction_vocabulary`

These are terms users commonly type in prompts that are semantically ambiguous or imprecise. The engine must map them to the correct structural intent before generation.

```json
{
  "correction_vocabulary": [

    { "user_term": "card", "ambiguities": ["list item card", "KPI card", "product card", "content card", "card container", "card modal"], "resolution": "If prompt context contains: 'list' or 'feed' → list_item. 'stats' or 'metric' → kpi_card. 'product' → product_detail component. 'form inside' → form_single in card. Default → list_item." },

    { "user_term": "popup", "ambiguities": ["modal dialog", "bottom sheet", "tooltip", "snackbar", "dropdown"], "resolution": "On mobile: → bottom_sheet. On desktop: → modal component. If 'notification' or 'alert' in context → snackbar/toast. Do not use literal popup component unless DS has one." },

    { "user_term": "menu", "ambiguities": ["hamburger menu", "dropdown menu", "context menu", "navigation menu", "tab menu"], "resolution": "If 'navigation' in context → sidebar_nav or bottom_nav_bar. If 'options' or 'more' → context menu / action sheet. If 'dropdown' → select_input component." },

    { "user_term": "header", "ambiguities": ["top app bar", "screen title", "section header", "hero header", "profile header"], "resolution": "If at top of screen → top_app_bar. If inside list → list_section_header. If hero-style with image → hero image + title_block. Default → top_app_bar." },

    { "user_term": "sidebar", "ambiguities": ["sidebar navigation", "side drawer", "filter sidebar", "info panel sidebar"], "resolution": "If mobile: use bottom_sheet or modal. If desktop: sidebar_nav. If 'filter' in context: use filter_bar (horizontal, not sidebar)." },

    { "user_term": "tab", "ambiguities": ["bottom tab bar", "top tab navigation", "filter tabs", "browser tabs"], "resolution": "If described as main navigation → bottom_nav_bar on mobile, sidebar_nav on desktop. If content filter → filter_bar or tab_bar. If 'content sections' → tab_bar_shell." },

    { "user_term": "button", "ambiguities": ["primary CTA", "secondary button", "icon button", "FAB", "text link", "chip"], "resolution": "Default to primary_cta. If 'ghost' or 'outline' or 'secondary' → secondary_action. If 'floating' or 'round' → fab_button. If 'icon only' → icon button component." },

    { "user_term": "notification", "ambiguities": ["notification center screen", "push notification", "in-app toast", "notification badge"], "resolution": "If a full screen → notification_center archetype. If inline alert → form_error_message. If transient → skip (not a layout component)." },

    { "user_term": "profile", "ambiguities": ["profile page", "user profile", "avatar component", "profile settings"], "resolution": "If full screen → profile_view archetype. If just avatar → user_avatar_block slot. If settings → settings_panel archetype." },

    { "user_term": "feed", "ambiguities": ["social feed", "activity feed", "news feed", "content list"], "resolution": "All resolve to list_feed archetype. Differentiate with list_item variant based on context." },

    { "user_term": "onboarding", "ambiguities": ["welcome screen (single)", "onboarding carousel", "setup wizard form", "feature tour"], "resolution": "If 'steps' or 'swipe' → onboarding_step archetype (one frame per step). If 'form' in context → form_multi_step. If single welcome → onboarding_step with step_indicator optional=false." },

    { "user_term": "loading", "ambiguities": ["loading screen", "skeleton screen", "loading state on button", "loading indicator"], "resolution": "If full screen → create empty frame with centered loading indicator component. If button state → set primary_cta property State=Loading. Do not create a separate archetype for loading screens." },

    { "user_term": "search", "ambiguities": ["search bar component", "search results screen", "search overlay", "in-list search"], "resolution": "If top of a list → search_input slot. If dedicated screen with results → search_results archetype. If floating overlay → use search_input positioned as overlay." },

    { "user_term": "checkout", "ambiguities": ["cart screen", "payment form", "order review", "confirmation after payment"], "resolution": "Order review → checkout_cart. Payment form fields → form_single with payment context. After payment → confirmation_screen." },

    { "user_term": "gallery", "ambiguities": ["photo gallery grid", "product image carousel", "media library", "file grid"], "resolution": "Grid view → media_gallery archetype. Product image slider → product_image slot with carousel variant. File manager → list_feed with icon list items." },

    { "user_term": "map", "ambiguities": ["map view screen", "map embedded in card", "location picker", "route view"], "resolution": "Full screen → map_view archetype. Embedded in card → map_placeholder slot within detail_view. Location picker → form field + map_placeholder." },

    { "user_term": "chat", "ambiguities": ["chat list (conversations)", "chat thread (messages)", "AI chat interface", "comments section"], "resolution": "Thread of messages → chat_messaging archetype. List of conversations → list_feed with conversation list items. Comments → detail_view with comments_section slot." },

    { "user_term": "settings", "ambiguities": ["app settings", "account settings", "notification settings", "privacy settings"], "resolution": "All → settings_panel archetype. Differentiate by section headers in content_defaults." },

    { "user_term": "modal", "ambiguities": ["dialog", "bottom sheet", "alert dialog", "full-screen modal"], "resolution": "On mobile: bottom_sheet slot. On desktop: use modal/dialog component from DS. Alert type: form_error_message. Confirmation: use modal with two-button layout." },

    { "user_term": "splash screen", "ambiguities": ["launch screen", "loading screen", "welcome", "brand screen"], "resolution": "Map to onboarding_step with brand_logo, illustration_placeholder, no primary_cta or step_indicator. Single screen only." },

    { "user_term": "home", "ambiguities": ["home screen", "home tab", "landing page", "main screen"], "resolution": "Default → home_dashboard archetype. If no DS navigation components found → list_feed. If ecommerce context → checkout_cart or product_detail." },

    { "user_term": "review", "ambiguities": ["order review (checkout)", "review/rating UI", "peer review form", "code review"], "resolution": "Order review → checkout_cart. Star rating UI → rating_block slot inside detail_view. Review form → form_single." }
  ]
}
```

---

## SECTION 13 — `hierarchy_rules`

Universal design quality rules that apply to every generated frame, regardless of archetype. These are the non-negotiables.

```json
{
  "hierarchy_rules": [

    {
      "id": "H-001",
      "rule": "One primary CTA per frame",
      "description": "A frame may contain at most one component resolved to the primary_cta slot. If the action plan would produce two primary CTAs, demote the second to secondary_action.",
      "enforcement": "hard"
    },

    {
      "id": "H-002",
      "rule": "Maximum two heading levels per frame",
      "description": "A generated frame should not contain more than two distinct text hierarchy levels visible simultaneously (e.g. H1 + Body is fine, H1 + H2 + H3 + Body creates visual noise). If more levels are needed, split into sections.",
      "enforcement": "soft — log warning if violated"
    },

    {
      "id": "H-003",
      "rule": "Interactive elements above decorative elements in reading order",
      "description": "When building the auto-layout stack, inputs and CTAs should come after contextual content (title, description) but before decorative or supplementary elements. The user should read context, then act.",
      "enforcement": "soft"
    },

    {
      "id": "H-004",
      "rule": "No auth UI in navigated screens",
      "description": "Frames identified as post-login screens (home_dashboard, list_feed, detail_view, settings_panel, profile_view, etc.) must not contain login, register, or password input slots.",
      "enforcement": "hard"
    },

    {
      "id": "H-005",
      "rule": "Bottom navigation must have 3-5 items",
      "description": "If a bottom_nav_bar component is placed, it must be configured with 3, 4, or 5 tab items. 2 tabs feel unbalanced; 6+ tabs are unusable.",
      "enforcement": "hard"
    },

    {
      "id": "H-006",
      "rule": "Empty states must have a path forward",
      "description": "Every empty_state and error_screen must include at least one action (primary_cta or secondary_action). A dead end with no escape is a critical UX failure.",
      "enforcement": "hard"
    },

    {
      "id": "H-007",
      "rule": "Sticky bottom elements must be separated from scroll content",
      "description": "When a primary_cta or message_input_bar is positioned as bottom_fixed, it must be in a separate auto-layout frame from the scrollable content. Never overlap a fixed element with scroll content at the same layout level.",
      "enforcement": "hard"
    },

    {
      "id": "H-008",
      "rule": "No more than 4 form fields in a single step",
      "description": "Single-step forms can have up to 8 fields, but multi-step form patterns should not exceed 4 fields per step. If the prompt requests more, split across steps and escalate to form_multi_step archetype.",
      "enforcement": "soft — suggest upgrade to multi-step, do not force"
    },

    {
      "id": "H-009",
      "rule": "Confirmation screens use positive language only",
      "description": "The title_block and description_block on confirmation_screen archetype must not contain negation, conditional, or warning language. Kimi enrichment must enforce this when generating copy.",
      "enforcement": "hard for Kimi enrichment"
    },

    {
      "id": "H-010",
      "rule": "Destructive actions must be visually distinct and positioned last",
      "description": "Any slot resolved as destructive_action_row must use the error/danger color token and be placed at the bottom of its parent section — never first, never adjacent to a non-destructive primary action.",
      "enforcement": "hard"
    },

    {
      "id": "H-011",
      "rule": "Illustration placeholders do not double as interactive elements",
      "description": "illustration_placeholder and success_illustration slots must not be placed inside button components or made interactive. They are static visual elements.",
      "enforcement": "hard"
    },

    {
      "id": "H-012",
      "rule": "Content width constraint on desktop",
      "description": "On desktop layouts, the main content area must respect max_content_width (default 1200px for full layouts, 480px for auth/narrow panels). Do not create full-bleed text columns on desktop.",
      "enforcement": "hard"
    }
  ]
}
```

---

## SECTION 14 — `test_prompts`

20 test prompts to validate the engine end-to-end. Coverage: 5 poor / 5 medium / 5 rich / 5 edge cases.

### Group A — Poor Prompts (minimal input, must infer everything)

```json
{
  "test_prompts": {

    "group_A_poor": [
      {
        "id": "TP-A01",
        "prompt": "login",
        "expected_archetype": "login",
        "expected_pattern": "auth_login_mobile",
        "expected_slots": ["email_input", "password_input", "primary_cta"],
        "must_not_contain": ["step_indicator", "tab_bar", "data_table"],
        "quality_notes": [
          "Title must default to 'Welcome back'",
          "Primary CTA must say 'Sign In'"
        ]
      },
      {
        "id": "TP-A02",
        "prompt": "settings",
        "expected_archetype": "settings_panel",
        "expected_pattern": "settings_mobile",
        "expected_slots": ["top_app_bar", "settings_section_header", "settings_row"],
        "must_not_contain": ["chart", "kpi_card", "login_form"],
        "quality_notes": [
          "Must have at least 2 section headers",
          "Destructive action (Log out) must be last if included"
        ]
      },
      {
        "id": "TP-A03",
        "prompt": "home",
        "expected_archetype": "home_dashboard",
        "expected_pattern": "dashboard_mobile",
        "expected_slots": ["top_app_bar"],
        "quality_notes": [
          "Should include at least one kpi_card if DS has card components",
          "Should include bottom_nav_bar if DS has navigation components"
        ]
      },
      {
        "id": "TP-A04",
        "prompt": "empty",
        "expected_archetype": "empty_state",
        "expected_pattern": "empty_state_centered",
        "expected_slots": ["illustration_placeholder", "title_block", "primary_cta"],
        "quality_notes": [
          "Must include a path forward (primary_cta)",
          "Title must say 'Nothing to see here' or Kimi-enriched equivalent"
        ]
      },
      {
        "id": "TP-A05",
        "prompt": "error",
        "expected_archetype": "error_screen",
        "expected_pattern": "empty_state_centered",
        "expected_slots": ["illustration_placeholder", "title_block", "primary_cta"],
        "quality_notes": [
          "Must default to 500 error copy",
          "Primary CTA must say 'Try Again'"
        ]
      }
    ],

    "group_B_medium": [
      {
        "id": "TP-B01",
        "prompt": "A login screen with email and password fields, a sign in button, and a link to create a new account",
        "expected_archetype": "login",
        "expected_pattern": "auth_login_mobile",
        "expected_slots": ["email_input", "password_input", "primary_cta", "secondary_action"],
        "quality_notes": [
          "secondary_action copy must reference 'create account' or 'sign up'",
          "forgot_password_link should be included as it is common in this context"
        ]
      },
      {
        "id": "TP-B02",
        "prompt": "Notification screen showing recent alerts with a mark all as read option",
        "expected_archetype": "notification_center",
        "expected_pattern": "list_feed_mobile",
        "expected_slots": ["top_app_bar", "list_item"],
        "must_not_contain": ["form_field", "step_indicator"],
        "quality_notes": [
          "mark_all_read action must appear in top_app_bar or as section header action",
          "List items must be repeatable, 3-5 instances"
        ]
      },
      {
        "id": "TP-B03",
        "prompt": "Onboarding with 3 steps showing app features, with skip and next buttons",
        "expected_archetype": "onboarding_step",
        "expected_pattern": "onboarding_step_mobile",
        "expected_slots": ["step_indicator", "title_block", "description_block", "primary_cta", "skip_action"],
        "quality_notes": [
          "step_indicator must show 3 steps, step 1 active",
          "skip_action must be positioned top-right or below primary CTA"
        ]
      },
      {
        "id": "TP-B04",
        "prompt": "A product page for a sneaker with image, price, size selector and add to cart",
        "expected_archetype": "product_detail",
        "expected_pattern": "product_detail_mobile",
        "expected_slots": ["product_image", "product_title", "product_price", "variant_selector", "sticky_cta_bar"],
        "quality_notes": [
          "Primary CTA must say 'Add to Cart'",
          "Sticky CTA must be bottom_fixed, not inline"
        ]
      },
      {
        "id": "TP-B05",
        "prompt": "Contact form with name, email, message fields and a send button",
        "expected_archetype": "form_single",
        "expected_pattern": "form_single_mobile",
        "expected_slots": ["title_block", "text_input", "email_input", "textarea_input", "primary_cta"],
        "must_not_contain": ["step_indicator", "progress_bar", "tab_bar"],
        "quality_notes": [
          "Primary CTA must say 'Send'",
          "No step indicator — single page form"
        ]
      }
    ],

    "group_C_rich": [
      {
        "id": "TP-C01",
        "prompt": "A mobile login screen for a fitness app. The user should enter their email and password. Below the form, offer a 'Forgot password?' link and a 'Sign up' option. Above the form, show the app logo and a motivational headline. Add a 'Continue with Google' button separated from the form by an OR divider.",
        "expected_archetype": "login",
        "expected_pattern": "auth_login_mobile",
        "expected_slots": ["brand_logo", "title_block", "email_input", "password_input", "forgot_password_link", "primary_cta", "divider_with_label", "social_auth", "secondary_action"],
        "quality_notes": [
          "Title should be motivational, not generic — Kimi enrichment eligible",
          "social_auth must appear BELOW the main form, not above it",
          "Spacing between form and social auth must use auth_family.primary_cta__secondary_action + divider spacing"
        ]
      },
      {
        "id": "TP-C02",
        "prompt": "A dashboard home screen for a project management tool. Show a greeting with the user name, 3 KPI cards (tasks complete, tasks in progress, overdue), a 'Recent Activity' section with 4 list items, and a floating action button to create a new task. Include a bottom navigation bar with Home, Projects, Team, and Profile tabs.",
        "expected_archetype": "home_dashboard",
        "expected_pattern": "dashboard_mobile",
        "expected_slots": ["top_app_bar", "greeting_block", "kpi_card", "section_header", "list_item", "fab_button", "bottom_nav_bar"],
        "quality_notes": [
          "Exactly 3 kpi_card instances",
          "Exactly 4 list_item instances in Recent Activity",
          "Bottom nav must have exactly 4 items",
          "FAB must be bottom_right_floating"
        ]
      },
      {
        "id": "TP-C03",
        "prompt": "A multi-step registration form for a banking app. Step 1 of 4: personal information (first name, last name, date of birth, nationality). Show a step progress indicator and a Continue button. Back navigation in the top left.",
        "expected_archetype": "form_multi_step",
        "expected_pattern": "form_multistep_mobile",
        "expected_slots": ["back_navigation", "step_indicator", "title_block", "description_block", "text_input", "primary_cta"],
        "quality_notes": [
          "step_indicator must show 4 steps, step 1 active",
          "text_input instances: first name, last name, date of birth, nationality = 4 fields",
          "Primary CTA must say 'Continue'"
        ]
      },
      {
        "id": "TP-C04",
        "prompt": "An e-commerce cart screen showing 2 products with quantity controls, a promo code field, an order summary with subtotal, shipping, and total, and a Proceed to Checkout button fixed at the bottom.",
        "expected_archetype": "checkout_cart",
        "expected_pattern": "checkout_cart_mobile",
        "expected_slots": ["top_app_bar", "cart_item_list", "promo_code_input", "divider", "order_summary", "primary_cta"],
        "quality_notes": [
          "Primary CTA must be bottom_fixed",
          "Order summary must show subtotal + shipping + total",
          "Primary CTA must say 'Proceed to Checkout' or 'Proceed to Payment'"
        ]
      },
      {
        "id": "TP-C05",
        "prompt": "A settings screen for a social app with sections: Account (edit profile, change password, linked accounts), Notifications (push notifications toggle, email notifications toggle), Privacy (who can see my posts, blocked users), Support (help center, contact us, rate the app), and Danger Zone (delete account in red). Back navigation at the top.",
        "expected_archetype": "settings_panel",
        "expected_pattern": "settings_mobile",
        "expected_slots": ["top_app_bar", "back_navigation", "settings_section_header", "settings_row", "toggle_row", "destructive_action_row"],
        "quality_notes": [
          "Exactly 5 section headers",
          "Toggle rows for notification settings",
          "Destructive action (delete account) must be last and styled in error color",
          "back_navigation must be in top_app_bar"
        ]
      }
    ],

    "group_D_edge_cases": [
      {
        "id": "TP-D01",
        "prompt": "lgoin",
        "note": "Misspelled prompt — tests normalization and fuzzy inference",
        "expected_archetype": "login",
        "expected_behavior": "Engine normalizes 'lgoin' → closest match 'login' with confidence > 0.7",
        "quality_notes": [
          "Must not fail with zero results",
          "Must not trigger disambiguation — misspelling of common word must be resolved"
        ]
      },
      {
        "id": "TP-D02",
        "prompt": "dashboard with login",
        "note": "Two conflicting archetypes in one prompt",
        "expected_behavior": "Engine detects conflict between home_dashboard and login. Triggers disambiguation. Asks: 'Should this screen show a login form or a post-login dashboard?'",
        "expected_archetype": "ambiguous — must disambiguate",
        "quality_notes": [
          "Must NOT generate a frame that combines login form with dashboard chrome",
          "Must surface disambiguation question via [CONV_UX]"
        ]
      },
      {
        "id": "TP-D03",
        "prompt": "I need a screen for when there's nothing in the list but the user should be able to add their first item. Make it encouraging and not sad.",
        "note": "Long conversational prompt — tests copy tone inference",
        "expected_archetype": "empty_state",
        "expected_pattern": "empty_state_centered",
        "expected_slots": ["illustration_placeholder", "title_block", "description_block", "primary_cta"],
        "quality_notes": [
          "Copy must be positive/encouraging — not 'No content found'",
          "Primary CTA must reference 'Add' or 'Create'",
          "If Kimi enrichment is active, tone must be uplifting"
        ]
      },
      {
        "id": "TP-D04",
        "prompt": "A screen for sending a message to a user after I click on their name in a list",
        "note": "Implicit archetype — tests context-based inference",
        "expected_archetype": "chat_messaging",
        "expected_pattern": "chat_mobile",
        "expected_slots": ["top_app_bar", "message_bubble", "message_input_bar"],
        "quality_notes": [
          "Must not generate a form_single with a textarea",
          "Top app bar should show contact name",
          "Message input bar must be bottom_fixed"
        ]
      },
      {
        "id": "TP-D05",
        "prompt": "make it look good",
        "note": "Zero-information prompt — tests graceful failure",
        "expected_behavior": "Engine cannot infer archetype. Confidence = 0. Triggers low_confidence_generic disambiguation.",
        "expected_archetype": "none — disambiguation required",
        "quality_notes": [
          "Must not generate anything",
          "Must ask: 'What is the main purpose of this screen? What should the user be able to do?'",
          "Must not default silently to any archetype"
        ]
      }
    ]
  }
}
```

---

*COMTRA by Ben & Cordiska — Design Intelligence Pack v2.0 — Internal document*
*Do not distribute outside the Comtra team.*
